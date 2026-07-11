import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type {
  AgendaData,
  ClassEntry,
  Expense,
  Pack,
  Payment,
  PaymentMethod,
  Prices,
  Settings,
  Student,
} from '../types';
import { agendaReducer } from './agendaReducer';
import { exportToFile, importFromFile, loadData, saveData } from '../lib/storage';
import { computeLedger, dayKeyToISO, type Ledger } from '../lib/money';
import { newId } from '../lib/id';

/** Datos para registrar un pago manual (los ids/fechas se completan solos). */
export interface NewPaymentInput {
  studentId: string;
  amount: number;
  methodId: string;
  date: string; // "YYYY-MM-DD"
  concept?: string;
  kind?: Payment['kind'];
  /** Si el pago salda una clase puntual (pago parcial atado a esa clase). */
  classRef?: { day: string; hour: number };
}

interface AgendaContextValue {
  data: AgendaData;
  /** Estado financiero derivado (recalculado ante cada cambio). */
  ledger: Ledger;
  setPrices: (prices: Prices) => void;
  upsertClass: (day: string, hour: number, entry: ClassEntry) => void;
  deleteClass: (day: string, hour: number) => void;
  upsertStudent: (student: Student) => void;
  setStudentActive: (id: string, active: boolean) => void;
  /** Registra un pago y devuelve el registro creado (para el recibo). */
  addPayment: (input: NewPaymentInput) => Payment;
  deletePayment: (id: string) => void;
  /** Cobro rápido de una clase: salda el resto de cada alumno con el medio por defecto (hoy). */
  quickCollectClass: (day: string, hour: number) => void;
  /** Deshace el cobro rápido de una clase (borra sus pagos). */
  undoCollectClass: (day: string, hour: number) => void;
  /** Crea un pack (bono prepago) + su pago de compra. */
  addPack: (input: { studentId: string; totalClasses: number; price: number; date: string; methodId: string }) => void;
  deletePack: (id: string) => void;
  upsertExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  setPaymentMethods: (methods: PaymentMethod[]) => void;
  setSettings: (settings: Settings) => void;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
}

const AgendaContext = createContext<AgendaContextValue | null>(null);

/** Fecha de hoy en formato "YYYY-MM-DD". */
function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function AgendaProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(agendaReducer, undefined, loadData);

  // Persiste automáticamente en localStorage ante cualquier cambio de estado.
  useEffect(() => {
    saveData(data);
  }, [data]);

  // Recalcula todo el estado financiero derivado cuando cambian los datos.
  const ledger = useMemo(() => computeLedger(data), [data]);

  const value = useMemo<AgendaContextValue>(() => {
    function addPayment(input: NewPaymentInput): Payment {
      const payment: Payment = {
        id: newId(),
        studentId: input.studentId,
        amount: input.amount,
        methodId: input.methodId,
        date: input.date,
        concept: input.concept,
        kind: input.kind ?? 'clase',
        classRef: input.classRef,
      };
      dispatch({ type: 'ADD_PAYMENT', payload: payment });
      return payment;
    }

    return {
      data,
      ledger,
      setPrices: (prices) => dispatch({ type: 'SET_PRICES', payload: prices }),
      upsertClass: (day, hour, entry) => dispatch({ type: 'UPSERT_CLASS', payload: { day, hour, entry } }),
      deleteClass: (day, hour) => dispatch({ type: 'DELETE_CLASS', payload: { day, hour } }),
      upsertStudent: (student) => dispatch({ type: 'UPSERT_STUDENT', payload: student }),
      setStudentActive: (id, active) => dispatch({ type: 'SET_STUDENT_ACTIVE', payload: { id, active } }),
      addPayment,
      deletePayment: (id) => dispatch({ type: 'DELETE_PAYMENT', payload: { id } }),

      quickCollectClass: (day, hour) => {
        // Salda, para cada alumno con ficha de la clase, lo que le queda adeudado.
        const acc = ledger.byClass[`${day}|${hour}`];
        if (!acc) return;
        const slots = data.days[day];
        const entry = slots?.[String(hour)];
        if (!entry) return;
        const method = data.settings.defaultMethodId;
        const date = todayISO();
        for (const p of entry.participants) {
          if (!p.studentId) continue;
          const part = ledger.byStudent[p.studentId]?.participations.find(
            (pp) => pp.day === day && pp.hour === hour
          );
          if (!part) continue;
          const remaining = part.owed - part.paidToward;
          if (remaining <= 0.0001) continue;
          dispatch({
            type: 'ADD_PAYMENT',
            payload: {
              id: newId(),
              studentId: p.studentId,
              amount: remaining,
              methodId: method,
              date,
              concept: 'Cobro de clase',
              kind: 'clase',
              classRef: { day, hour },
            },
          });
        }
      },

      undoCollectClass: (day, hour) => dispatch({ type: 'DELETE_PAYMENTS_BY_CLASS', payload: { day, hour } }),

      addPack: (input) => {
        const packId = newId();
        const pack: Pack = {
          id: packId,
          studentId: input.studentId,
          totalClasses: input.totalClasses,
          price: input.price,
          purchaseDate: input.date,
          methodId: input.methodId,
        };
        const payment: Payment = {
          id: newId(),
          studentId: input.studentId,
          amount: input.price,
          methodId: input.methodId,
          date: input.date,
          concept: `Compra de pack (${input.totalClasses} clases)`,
          kind: 'pack',
          packId,
        };
        dispatch({ type: 'ADD_PACK', payload: { pack, payment } });
      },
      deletePack: (id) => dispatch({ type: 'DELETE_PACK', payload: { id } }),

      upsertExpense: (expense) => dispatch({ type: 'UPSERT_EXPENSE', payload: expense }),
      deleteExpense: (id) => dispatch({ type: 'DELETE_EXPENSE', payload: { id } }),

      setPaymentMethods: (methods) => dispatch({ type: 'SET_PAYMENT_METHODS', payload: methods }),
      setSettings: (settings) => dispatch({ type: 'SET_SETTINGS', payload: settings }),

      exportData: () => exportToFile(data),
      importData: async (file: File) => {
        const imported = await importFromFile(file);
        dispatch({ type: 'LOAD', payload: imported });
      },
    };
  }, [data, ledger]);

  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>;
}

export function useAgenda(): AgendaContextValue {
  const ctx = useContext(AgendaContext);
  if (!ctx) throw new Error('useAgenda debe usarse dentro de <AgendaProvider>');
  return ctx;
}

// Reexport para comodidad de los componentes.
export { dayKeyToISO };
