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

/** Una clase con su ubicación (inicio en minutos), para altas en lote (series, copiar semana). */
export interface PlacedClass {
  day: string;
  start: number;
  entry: ClassEntry;
}

export type AgendaAction =
  | { type: 'LOAD'; payload: AgendaData }
  | { type: 'SET_PRICES'; payload: Prices }
  | { type: 'UPSERT_CLASS'; payload: { day: string; start: number; entry: ClassEntry } }
  | { type: 'RELOCATE_CLASS'; payload: { day: string; fromStart: number; toStart: number; entry: ClassEntry } }
  | { type: 'DELETE_CLASS'; payload: { day: string; start: number } }
  | { type: 'REMOVE_PARTICIPANT'; payload: { day: string; start: number; index: number } }
  | { type: 'SET_ATTENDANCE'; payload: { day: string; start: number; index: number; attended: boolean | undefined } }
  | { type: 'SET_REMINDER'; payload: { day: string; start: number; reminder: Reminder | null } }
  | { type: 'ADD_CLASSES'; payload: { entries: PlacedClass[] } }
  | { type: 'MOVE_CLASS'; payload: { from: { day: string; start: number }; to: { day: string; start: number } } }
  | { type: 'DELETE_SERIES'; payload: { seriesId: string } }
  | { type: 'UPDATE_SERIES'; payload: { seriesId: string; patch: Partial<ClassEntry> } }
  | { type: 'SET_BLOCK'; payload: { day: string; block: DayBlock } }
  | { type: 'REMOVE_BLOCK'; payload: { day: string } }
  | { type: 'UPSERT_STUDENT'; payload: Student }
  | { type: 'SET_STUDENT_ACTIVE'; payload: { id: string; active: boolean } }
  | { type: 'ADD_PAYMENT'; payload: Payment }
  | { type: 'DELETE_PAYMENT'; payload: { id: string } }
  | { type: 'DELETE_PAYMENTS_BY_CLASS'; payload: { day: string; start: number } }
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

/**
 * Desliga (quita el `classRef`) los pagos atados a una clase. Si se pasa `studentId`,
 * solo los de ese alumno; si es null, los de todos. El pago sigue existiendo (la plata
 * NO se pierde): pasa a crédito libre que se aplica FIFO a lo que el alumno adeuda.
 */
function detachClassPayments(
  payments: Record<string, Payment>,
  day: string,
  start: number,
  studentId: string | null
): Record<string, Payment> {
  let changed = false;
  const next: Record<string, Payment> = { ...payments };
  for (const [id, pay] of Object.entries(next)) {
    if (!pay.classRef || pay.classRef.day !== day || pay.classRef.start !== start) continue;
    if (studentId !== null && pay.studentId !== studentId) continue;
    next[id] = { ...pay, classRef: undefined };
    changed = true;
  }
  return changed ? next : payments;
}

export function agendaReducer(state: AgendaData, action: AgendaAction): AgendaData {
  switch (action.type) {
    case 'LOAD':
      return action.payload;

    case 'SET_PRICES':
      return { ...state, prices: action.payload };

    case 'UPSERT_CLASS': {
      const { day, start, entry } = action.payload;
      const daySlots = { ...(state.days[day] || {}), [String(start)]: entry };
      return { ...state, days: { ...state.days, [day]: daySlots } };
    }

    case 'RELOCATE_CLASS': {
      // Mueve una clase a otro inicio DENTRO del mismo día (al cambiar la hora en el editor)
      // y aplica los cambios del entry. Re-apunta los pagos atados (classRef) a la nueva
      // hora, así NO se pierde el vínculo ni la plata. Si el inicio no cambia, es un upsert.
      const { day, fromStart, toStart, entry } = action.payload;
      const slots = { ...(state.days[day] || {}) };
      if (fromStart !== toStart) delete slots[String(fromStart)];
      slots[String(toStart)] = entry;
      const days = { ...state.days, [day]: slots };
      if (fromStart === toStart) return { ...state, days };
      // Re-apuntar los pagos de esta clase al nuevo inicio.
      const payments = { ...state.payments };
      for (const [id, pay] of Object.entries(payments)) {
        if (pay.classRef && pay.classRef.day === day && pay.classRef.start === fromStart) {
          payments[id] = { ...pay, classRef: { day, start: toStart } };
        }
      }
      return { ...state, days, payments };
    }

    case 'SET_ATTENDANCE': {
      // Marca la asistencia de UN alumno del turno (vino / no vino / sin marcar). Es solo un
      // registro: NO toca precio, pagos ni estado, así que la plata queda EXACTAMENTE igual.
      const { day, start, index, attended } = action.payload;
      const slots = state.days[day];
      const entry = slots?.[String(start)];
      if (!entry || !entry.participants[index]) return state;
      const nextParticipants = entry.participants.map((p, i) => {
        if (i !== index) return p;
        const np = { ...p };
        if (attended === undefined) delete np.attended;
        else np.attended = attended;
        return np;
      });
      const nextEntry: ClassEntry = { ...entry, participants: nextParticipants };
      return { ...state, days: { ...state.days, [day]: { ...slots, [String(start)]: nextEntry } } };
    }

    case 'SET_REMINDER': {
      // Pone/edita/borra el recordatorio de un turno (queda dentro del ClassEntry).
      const { day, start, reminder } = action.payload;
      const slots = state.days[day];
      const entry = slots?.[String(start)];
      if (!entry) return state;
      const nextEntry: ClassEntry = { ...entry };
      if (reminder) nextEntry.reminder = reminder;
      else delete nextEntry.reminder;
      return { ...state, days: { ...state.days, [day]: { ...slots, [String(start)]: nextEntry } } };
    }

    case 'DELETE_CLASS': {
      // Borra el turno entero. Se desligan los pagos atados a esa clase (pasan a crédito
      // libre del alumno), para no dejar referencias colgadas a una clase que ya no existe.
      const { day, start } = action.payload;
      if (!state.days[day]) return state;
      const daySlots = { ...state.days[day] };
      delete daySlots[String(start)];
      const days = { ...state.days };
      if (Object.keys(daySlots).length === 0) delete days[day];
      else days[day] = daySlots;
      const payments = detachClassPayments(state.payments, day, start, null);
      return { ...state, days, payments };
    }

    case 'REMOVE_PARTICIPANT': {
      // Saca a un alumno puntual de una clase. En grupal cada alumno tiene su precio
      // propio (v8), así que el total pasa a ser la suma de los que quedan. Si no queda
      // nadie, se libera el turno (se borra la clase). Funciona también con el último.
      const { day, start, index } = action.payload;
      const slots = state.days[day];
      const entry = slots?.[String(start)];
      if (!entry) return state;
      const removed = entry.participants[index];
      if (!removed) return state;
      const nextParticipants = entry.participants.filter((_, i) => i !== index);

      let days: AgendaData['days'];
      if (nextParticipants.length === 0) {
        // Turno libre: se borra la clase (el modelo no guarda clases sin alumnos).
        const daySlots = { ...slots };
        delete daySlots[String(start)];
        days = { ...state.days };
        if (Object.keys(daySlots).length === 0) delete days[day];
        else days[day] = daySlots;
      } else {
        const oldLen = entry.participants.length;
        const nextPrice =
          entry.type === 'grupal'
            ? nextParticipants.reduce((sum, p) => sum + (p.price ?? entry.price / oldLen), 0)
            : entry.price;
        const nextEntry: ClassEntry = { ...entry, participants: nextParticipants, price: nextPrice };
        days = { ...state.days, [day]: { ...slots, [String(start)]: nextEntry } };
      }

      const payments = detachClassPayments(state.payments, day, start, removed.studentId);
      return { ...state, days, payments };
    }

    case 'ADD_CLASSES': {
      // Alta en lote (series recurrentes, copiar semana). No pisa lo existente.
      const days = { ...state.days };
      for (const { day, start, entry } of action.payload.entries) {
        const daySlots = { ...(days[day] || {}) };
        if (daySlots[String(start)]) continue; // ya hay clase en esa franja: se omite
        daySlots[String(start)] = entry;
        days[day] = daySlots;
      }
      return { ...state, days };
    }

    case 'MOVE_CLASS': {
      const { from, to } = action.payload;
      const entry = state.days[from.day]?.[String(from.start)];
      if (!entry) return state;
      const days = { ...state.days };
      // Sacar del origen.
      const fromSlots = { ...days[from.day] };
      delete fromSlots[String(from.start)];
      if (Object.keys(fromSlots).length === 0) delete days[from.day];
      else days[from.day] = fromSlots;
      // Poner en el destino.
      const toSlots = { ...(days[to.day] || {}) };
      toSlots[String(to.start)] = entry;
      days[to.day] = toSlots;
      // Re-apuntar los pagos atados a la clase movida (para no perder el vínculo).
      const payments = { ...state.payments };
      for (const [id, pay] of Object.entries(payments)) {
        if (pay.classRef && pay.classRef.day === from.day && pay.classRef.start === from.start) {
          payments[id] = { ...pay, classRef: { day: to.day, start: to.start } };
        }
      }
      return { ...state, days, payments };
    }

    case 'DELETE_SERIES': {
      const { seriesId } = action.payload;
      const days: AgendaData['days'] = {};
      for (const [day, slots] of Object.entries(state.days)) {
        const kept: Record<string, ClassEntry> = {};
        for (const [startStr, entry] of Object.entries(slots)) {
          if (entry.seriesId !== seriesId) kept[startStr] = entry;
        }
        if (Object.keys(kept).length > 0) days[day] = kept;
      }
      return { ...state, days };
    }

    case 'UPDATE_SERIES': {
      // Propaga cambios de contenido a toda la serie (conserva día/hora/serie de c/u).
      const { seriesId, patch } = action.payload;
      const days: AgendaData['days'] = {};
      for (const [day, slots] of Object.entries(state.days)) {
        const next: Record<string, ClassEntry> = {};
        for (const [startStr, entry] of Object.entries(slots)) {
          if (entry.seriesId === seriesId) {
            next[startStr] = { ...entry, ...patch, seriesId: entry.seriesId };
          } else {
            next[startStr] = entry;
          }
        }
        days[day] = next;
      }
      return { ...state, days };
    }

    case 'SET_BLOCK': {
      const { day, block } = action.payload;
      return { ...state, blocks: { ...state.blocks, [day]: block } };
    }

    case 'REMOVE_BLOCK':
      return { ...state, blocks: without(state.blocks, action.payload.day) };

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
      const { day, start } = action.payload;
      const payments = { ...state.payments };
      for (const [id, pay] of Object.entries(payments)) {
        if (pay.classRef && pay.classRef.day === day && pay.classRef.start === start) delete payments[id];
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
