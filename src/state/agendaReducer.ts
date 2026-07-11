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

export type AgendaAction =
  | { type: 'LOAD'; payload: AgendaData }
  | { type: 'SET_PRICES'; payload: Prices }
  | { type: 'UPSERT_CLASS'; payload: { day: string; hour: number; entry: ClassEntry } }
  | { type: 'DELETE_CLASS'; payload: { day: string; hour: number } }
  | { type: 'UPSERT_STUDENT'; payload: Student }
  | { type: 'SET_STUDENT_ACTIVE'; payload: { id: string; active: boolean } }
  | { type: 'ADD_PAYMENT'; payload: Payment }
  | { type: 'DELETE_PAYMENT'; payload: { id: string } }
  | { type: 'DELETE_PAYMENTS_BY_CLASS'; payload: { day: string; hour: number } }
  | { type: 'ADD_PACK'; payload: { pack: Pack; payment: Payment } }
  | { type: 'DELETE_PACK'; payload: { id: string } }
  | { type: 'UPSERT_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: { id: string } }
  | { type: 'SET_PAYMENT_METHODS'; payload: PaymentMethod[] }
  | { type: 'SET_SETTINGS'; payload: Settings };

/** Quita una entrada de un Record por id, devolviendo un nuevo Record. */
function without<T>(record: Record<string, T>, id: string): Record<string, T> {
  const next = { ...record };
  delete next[id];
  return next;
}

export function agendaReducer(state: AgendaData, action: AgendaAction): AgendaData {
  switch (action.type) {
    case 'LOAD':
      return action.payload;

    case 'SET_PRICES':
      return { ...state, prices: action.payload };

    case 'UPSERT_CLASS': {
      const { day, hour, entry } = action.payload;
      const daySlots = { ...(state.days[day] || {}), [String(hour)]: entry };
      return { ...state, days: { ...state.days, [day]: daySlots } };
    }

    case 'DELETE_CLASS': {
      const { day, hour } = action.payload;
      if (!state.days[day]) return state;
      const daySlots = { ...state.days[day] };
      delete daySlots[String(hour)];
      const days = { ...state.days };
      if (Object.keys(daySlots).length === 0) delete days[day];
      else days[day] = daySlots;
      return { ...state, days };
    }

    case 'UPSERT_STUDENT': {
      const student = action.payload;
      return { ...state, students: { ...state.students, [student.id]: student } };
    }

    case 'SET_STUDENT_ACTIVE': {
      const { id, active } = action.payload;
      const existing = state.students[id];
      if (!existing) return state;
      return { ...state, students: { ...state.students, [id]: { ...existing, active } } };
    }

    case 'ADD_PAYMENT': {
      const pay = action.payload;
      return { ...state, payments: { ...state.payments, [pay.id]: pay } };
    }

    case 'DELETE_PAYMENT':
      return { ...state, payments: without(state.payments, action.payload.id) };

    case 'DELETE_PAYMENTS_BY_CLASS': {
      // Deshacer el cobro rápido de una clase: borra los pagos con ese classRef.
      const { day, hour } = action.payload;
      const payments = { ...state.payments };
      for (const [id, pay] of Object.entries(payments)) {
        if (pay.classRef && pay.classRef.day === day && pay.classRef.hour === hour) delete payments[id];
      }
      return { ...state, payments };
    }

    case 'ADD_PACK': {
      // Comprar un pack crea el pack + su pago (kind 'pack').
      const { pack, payment } = action.payload;
      return {
        ...state,
        packs: { ...state.packs, [pack.id]: pack },
        payments: { ...state.payments, [payment.id]: payment },
      };
    }

    case 'DELETE_PACK': {
      // Borra el pack y el pago de compra asociado.
      const { id } = action.payload;
      const payments = { ...state.payments };
      for (const [pid, pay] of Object.entries(payments)) {
        if (pay.packId === id) delete payments[pid];
      }
      return { ...state, packs: without(state.packs, id), payments };
    }

    case 'UPSERT_EXPENSE': {
      const e = action.payload;
      return { ...state, expenses: { ...state.expenses, [e.id]: e } };
    }

    case 'DELETE_EXPENSE':
      return { ...state, expenses: without(state.expenses, action.payload.id) };

    case 'SET_PAYMENT_METHODS':
      return { ...state, paymentMethods: action.payload };

    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };

    default:
      return state;
  }
}
