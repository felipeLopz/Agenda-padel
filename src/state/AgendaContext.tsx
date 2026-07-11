import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AgendaData,
  ClassEntry,
  DayBlock,
  Expense,
  Pack,
  Payment,
  PaymentMethod,
  Prices,
  Reminder,
  Settings,
  Student,
} from '../types';
import { agendaReducer, type PlacedClass } from './agendaReducer';
import { exportToFile, importFromFile, loadData, saveData } from '../lib/storage';
import { computeLedger, dayKeyToISO, type Ledger } from '../lib/money';
import { newId } from '../lib/id';
import { addDays, dayKey } from '../lib/date';
import { seriesDayKeys, type RecurrenceInput } from '../lib/recurrence';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  decideInitialSync,
  getLocalUpdatedAt,
  hasMeaningfulData,
  pushRemote,
  setLocalOwnerId,
  setLocalUpdatedAt,
} from '../lib/cloudSync';
import { haptic, playCollectSound } from '../lib/feedback';
import { prefersReducedMotion } from '../lib/motion';

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
  /** Saca un alumno puntual de una clase (recalcula el total; si queda vacía, libera el turno). */
  removeParticipant: (day: string, hour: number, index: number) => void;
  /** Pone/edita/borra el recordatorio de un turno (null = borrar). */
  setReminder: (day: string, hour: number, reminder: Reminder | null) => void;
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
  // --- Agenda avanzada (v4) ---
  /** Crea una serie recurrente a partir de una clase. Devuelve cuántas creó/omitió. */
  createSeries: (
    startDay: string,
    hour: number,
    entry: ClassEntry,
    recurrence: RecurrenceInput
  ) => { created: number; skipped: number };
  /** Aplica cambios de contenido a toda la serie. */
  updateSeries: (seriesId: string, patch: Partial<ClassEntry>) => void;
  /** Borra todas las clases de una serie. */
  deleteSeries: (seriesId: string) => void;
  /** Mueve una clase a otra franja. Devuelve false si el destino ya está ocupado. */
  moveClass: (from: { day: string; hour: number }, to: { day: string; hour: number }) => boolean;
  /** Define/actualiza el bloqueo de un día. */
  setDayBlock: (day: string, block: DayBlock) => void;
  removeDayBlock: (day: string) => void;
  /** Copia las clases de una semana a otra. Devuelve cuántas copió/omitió. */
  copyWeek: (fromMonday: Date, toMonday: Date) => { copied: number; skipped: number };
  // --- Calidad de vida (v6) ---
  /** Cambia el tema visual (oscuro/claro) y lo recuerda. */
  setTheme: (theme: 'dark' | 'light') => void;
  /** Duplica una clase a otra franja. Devuelve false si el destino ya está ocupado. */
  duplicateClass: (from: { day: string; hour: number }, to: { day: string; hour: number }) => boolean;
  /** Info del último "deshacer" disponible (o null). */
  undoInfo: { label: string; at: number } | null;
  /** Deshace la última acción importante. */
  runUndo: () => void;
  /** Descarta el aviso de deshacer sin restaurar. */
  dismissUndo: () => void;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
  /** true mientras se baja la nube por primera vez al iniciar sesión (para skeletons). */
  initialLoading: boolean;
  /** Marca de tiempo del último guardado exitoso en la nube (para el check "Guardado"). */
  syncedAt: number;
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
  // Snapshot para "deshacer" (1 nivel): estado previo a la última acción importante.
  const [undoState, setUndoState] = useState<{ snapshot: AgendaData; label: string; at: number } | null>(null);
  // Estado visual (Tanda 3): carga inicial de la nube y último guardado exitoso.
  const [initialLoading, setInitialLoading] = useState(false);
  const [syncedAt, setSyncedAt] = useState(0);
  // Tema anterior, para animar SOLO el cambio de tema (no el arranque).
  const prevTheme = useRef<string | null>(null);

  // --- Sincronización en la nube (Tanda 6) ---
  const { user } = useAuth();
  const userId = user?.id ?? null; // string estable: NO cambia al refrescar el token
  // Bandera anti-loop: la sincronización inicial (bajar/migrar) NO debe disparar una
  // subida. Se habilita recién cuando termina el arranque.
  const syncReady = useRef(false);
  // Evita el "eco": cuando la app adopta los datos de la nube, ese cambio no se re-sube.
  const skipNextPush = useRef(false);
  // Guarda: la sincronización inicial corre UNA sola vez por usuario (no en cada
  // refresco de token ni al volver a la pestaña).
  const syncedForUser = useRef<string | null>(null);
  // Última versión de los datos, para usar en callbacks sin closures viejos.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  // Estado de la subida: retardo pendiente, sello del último cambio y si quedó algo
  // sin subir (para reintentar al reconectar o al ocultar/cerrar la pestaña).
  const pushTimer = useRef<number | null>(null);
  const hasUnsynced = useRef(false);
  const latestUpdatedAt = useRef<string>(getLocalUpdatedAt() ?? '');

  // Sube YA lo último que haya sin sincronizar (cancela el retardo pendiente).
  const flushPush = useCallback(async () => {
    if (pushTimer.current !== null) {
      clearTimeout(pushTimer.current);
      pushTimer.current = null;
    }
    if (!isSupabaseConfigured || !userId || !hasUnsynced.current) return;
    const updatedAt = latestUpdatedAt.current;
    const ok = await pushRemote(userId, dataRef.current, updatedAt);
    if (ok) {
      setLocalOwnerId(userId);
      setSyncedAt(Date.now());
    }
    // Solo se marca como sincronizado si mientras subía NO entró un cambio más nuevo.
    if (ok && latestUpdatedAt.current === updatedAt) hasUnsynced.current = false;
  }, [userId]);

  // Programa una subida con un pequeño retardo (agrupa cambios seguidos).
  const schedulePush = useCallback(
    (updatedAt: string) => {
      if (!isSupabaseConfigured || !userId) return;
      latestUpdatedAt.current = updatedAt;
      hasUnsynced.current = true;
      if (pushTimer.current !== null) clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(() => {
        void flushPush();
      }, 1500);
    },
    [userId, flushPush]
  );

  // Persiste en localStorage ante cualquier cambio (caché siempre disponible) y, si
  // el arranque ya terminó, programa la subida a la nube.
  useEffect(() => {
    saveData(data);
    if (!syncReady.current) return; // durante hidratación/arranque no se sube
    if (skipNextPush.current) {
      skipNextPush.current = false; // este cambio vino de la nube: no re-subir
      return;
    }
    const now = new Date().toISOString();
    setLocalUpdatedAt(now);
    schedulePush(now);
  }, [data, schedulePush]);

  // Arranque: corre UNA sola vez por login (atado a userId, un string estable). Los
  // refrescos de token o volver a la pestaña ya NO la re-ejecutan (antes bajaban y
  // pisaban datos a mitad de sesión). Decide qué gana sin pisar cambios locales.
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) {
      syncReady.current = true;
      setInitialLoading(false);
      return;
    }
    if (syncedForUser.current === userId) {
      syncReady.current = true; // ya sincronizado para este usuario: no repetir
      setInitialLoading(false);
      return;
    }
    let cancelled = false;
    syncReady.current = false;
    setInitialLoading(true);
    (async () => {
      const decision = await decideInitialSync(userId, dataRef.current);
      if (cancelled) return;
      switch (decision.action) {
        case 'adopt': // gana la nube (estrictamente más nueva): se cargan sus datos
          setLocalOwnerId(userId);
          setLocalUpdatedAt(decision.updatedAt);
          latestUpdatedAt.current = decision.updatedAt;
          hasUnsynced.current = false;
          skipNextPush.current = true;
          dispatch({ type: 'LOAD', payload: decision.data });
          break;
        case 'push': // gana lo local (o migración inicial): se sube
          setLocalOwnerId(userId);
          setLocalUpdatedAt(decision.updatedAt);
          latestUpdatedAt.current = decision.updatedAt;
          hasUnsynced.current = false;
          await pushRemote(userId, dataRef.current, decision.updatedAt);
          setSyncedAt(Date.now());
          break;
        case 'noop': // todo vacío: solo se marca el dueño de la caché
          setLocalOwnerId(userId);
          break;
        case 'offline': // sin conexión: se sigue con lo local y se reintenta luego
          hasUnsynced.current = hasMeaningfulData(dataRef.current);
          break;
      }
      syncReady.current = true;
      syncedForUser.current = userId; // marca: este usuario ya hizo su sync inicial
      setInitialLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Subida confiable: al ocultar o cerrar la pestaña se fuerza la subida pendiente
  // (no se espera el retardo), y al reconectar se reintenta. Así no se pierde nada.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') void flushPush();
    }
    function onPageHide() {
      void flushPush();
    }
    function onOnline() {
      if (hasUnsynced.current) void flushPush();
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
    };
  }, [flushPush]);

  // Limpieza del retardo pendiente al desmontar (p. ej. al cerrar sesión).
  useEffect(() => {
    return () => {
      if (pushTimer.current !== null) clearTimeout(pushTimer.current);
    };
  }, []);

  // Aplica el tema (oscuro/claro) al documento. Al CAMBIAR el tema (no al arrancar) hace
  // una transición gradual de colores, en vez de un flash.
  useEffect(() => {
    const theme = data.settings.theme ?? 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (prevTheme.current !== null && prevTheme.current !== theme && !prefersReducedMotion()) {
      document.documentElement.classList.add('theme-transition');
      window.setTimeout(() => document.documentElement.classList.remove('theme-transition'), 360);
    }
    prevTheme.current = theme;
  }, [data.settings.theme]);

  // Recalcula todo el estado financiero derivado cuando cambian los datos.
  const ledger = useMemo(() => computeLedger(data), [data]);

  const value = useMemo<AgendaContextValue>(() => {
    // Guarda el estado actual como punto de "deshacer" antes de una acción importante.
    function capture(label: string) {
      setUndoState({ snapshot: data, label, at: Date.now() });
    }

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
      initialLoading,
      syncedAt,
      setPrices: (prices) => dispatch({ type: 'SET_PRICES', payload: prices }),
      upsertClass: (day, hour, entry) => dispatch({ type: 'UPSERT_CLASS', payload: { day, hour, entry } }),
      deleteClass: (day, hour) => {
        capture('Clase borrada');
        haptic();
        dispatch({ type: 'DELETE_CLASS', payload: { day, hour } });
      },
      removeParticipant: (day, hour, index) => {
        capture('Alumno quitado del turno');
        haptic();
        dispatch({ type: 'REMOVE_PARTICIPANT', payload: { day, hour, index } });
      },
      setReminder: (day, hour, reminder) =>
        dispatch({ type: 'SET_REMINDER', payload: { day, hour, reminder } }),
      upsertStudent: (student) => dispatch({ type: 'UPSERT_STUDENT', payload: student }),
      setStudentActive: (id, active) => {
        capture(active ? 'Alumno reactivado' : 'Alumno archivado');
        dispatch({ type: 'SET_STUDENT_ACTIVE', payload: { id, active } });
      },
      addPayment,
      deletePayment: (id) => {
        capture('Pago borrado');
        dispatch({ type: 'DELETE_PAYMENT', payload: { id } });
      },

      quickCollectClass: (day, hour) => {
        // Salda, para cada alumno con ficha de la clase, lo que le queda adeudado.
        const acc = ledger.byClass[`${day}|${hour}`];
        if (!acc) return;
        const slots = data.days[day];
        const entry = slots?.[String(hour)];
        if (!entry) return;
        const method = data.settings.defaultMethodId;
        const date = todayISO();
        let didCollect = false;
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
          didCollect = true;
        }
        // Feedback opcional al cobrar: sonido (si está activado) + vibración sutil.
        if (didCollect) {
          playCollectSound(data.settings.soundOnCollect ?? false);
          haptic();
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
      deletePack: (id) => {
        capture('Pack borrado');
        dispatch({ type: 'DELETE_PACK', payload: { id } });
      },

      upsertExpense: (expense) => dispatch({ type: 'UPSERT_EXPENSE', payload: expense }),
      deleteExpense: (id) => {
        capture('Gasto borrado');
        dispatch({ type: 'DELETE_EXPENSE', payload: { id } });
      },

      setPaymentMethods: (methods) => dispatch({ type: 'SET_PAYMENT_METHODS', payload: methods }),
      setSettings: (settings) => dispatch({ type: 'SET_SETTINGS', payload: settings }),

      createSeries: (startDay, hour, entry, recurrence) => {
        const seriesId = newId();
        const keys = seriesDayKeys(startDay, recurrence);
        const placed: PlacedClass[] = [];
        let skipped = 0;
        for (const day of keys) {
          if (data.days[day]?.[String(hour)]) {
            skipped += 1; // ya hay clase en esa franja
            continue;
          }
          placed.push({ day, hour, entry: { ...entry, seriesId } });
        }
        if (placed.length) dispatch({ type: 'ADD_CLASSES', payload: { entries: placed } });
        return { created: placed.length, skipped };
      },

      updateSeries: (seriesId, patch) => dispatch({ type: 'UPDATE_SERIES', payload: { seriesId, patch } }),
      deleteSeries: (seriesId) => {
        capture('Serie borrada');
        dispatch({ type: 'DELETE_SERIES', payload: { seriesId } });
      },

      moveClass: (from, to) => {
        if (from.day === to.day && from.hour === to.hour) return true;
        if (data.days[to.day]?.[String(to.hour)]) return false; // destino ocupado
        capture('Clase movida');
        dispatch({ type: 'MOVE_CLASS', payload: { from, to } });
        return true;
      },

      setDayBlock: (day, block) => dispatch({ type: 'SET_BLOCK', payload: { day, block } }),
      removeDayBlock: (day) => dispatch({ type: 'REMOVE_BLOCK', payload: { day } }),

      copyWeek: (fromMonday, toMonday) => {
        const placed: PlacedClass[] = [];
        let skipped = 0;
        for (let i = 0; i < 7; i++) {
          const srcDay = dayKey(addDays(fromMonday, i));
          const dstDay = dayKey(addDays(toMonday, i));
          const slots = data.days[srcDay];
          if (!slots) continue;
          for (const [hourStr, entry] of Object.entries(slots)) {
            if (data.days[dstDay]?.[hourStr]) {
              skipped += 1;
              continue;
            }
            // Copia independiente: sin serie y estado 'confirmada'. Los pagos NO se
            // copian, así que la copia arranca impaga (no tiene pagos propios).
            placed.push({
              day: dstDay,
              hour: Number(hourStr),
              entry: {
                type: entry.type,
                participants: entry.participants,
                price: entry.price,
                duration: entry.duration,
                state: 'confirmada',
              },
            });
          }
        }
        if (placed.length) dispatch({ type: 'ADD_CLASSES', payload: { entries: placed } });
        return { copied: placed.length, skipped };
      },

      // --- Calidad de vida (v6) ---
      setTheme: (theme) => dispatch({ type: 'SET_SETTINGS', payload: { ...data.settings, theme } }),

      duplicateClass: (from, to) => {
        const entry = data.days[from.day]?.[String(from.hour)];
        if (!entry) return false;
        if (data.days[to.day]?.[String(to.hour)]) return false; // destino ocupado
        capture('Clase duplicada');
        // Copia alumnos, precio, descuentos, duración y contenido; sin serie, estado
        // confirmada, sin adjuntos (son de esa sesión) y sin pagos propios.
        dispatch({
          type: 'ADD_CLASSES',
          payload: {
            entries: [
              {
                day: to.day,
                hour: to.hour,
                entry: {
                  type: entry.type,
                  participants: entry.participants,
                  price: entry.price,
                  duration: entry.duration,
                  state: 'confirmada',
                  content: entry.content,
                },
              },
            ],
          },
        });
        return true;
      },

      undoInfo: undoState ? { label: undoState.label, at: undoState.at } : null,
      runUndo: () => {
        if (!undoState) return;
        dispatch({ type: 'LOAD', payload: undoState.snapshot });
        setUndoState(null);
      },
      dismissUndo: () => setUndoState(null),

      exportData: () => {
        exportToFile(data);
        // Registra la fecha del backup para el recordatorio.
        dispatch({ type: 'SET_SETTINGS', payload: { ...data.settings, lastExportAt: new Date().toISOString() } });
      },
      importData: async (file: File) => {
        const imported = await importFromFile(file);
        dispatch({ type: 'LOAD', payload: imported });
      },
    };
  }, [data, ledger, undoState, initialLoading, syncedAt]);

  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>;
}

export function useAgenda(): AgendaContextValue {
  const ctx = useContext(AgendaContext);
  if (!ctx) throw new Error('useAgenda debe usarse dentro de <AgendaProvider>');
  return ctx;
}

// Reexport para comodidad de los componentes.
export { dayKeyToISO };
