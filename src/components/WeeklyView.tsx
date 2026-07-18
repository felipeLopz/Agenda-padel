import { useState, type DragEvent, type MouseEvent } from 'react';
import { useAgenda } from '../state/AgendaContext';
import { WEEKDAY_NAMES_LONG, CLASS_TYPE_LABEL } from '../lib/constants';
import { addDays, dayKey, isToday, startOfWeek } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { dayTotals, classStatus } from '../lib/money';
import { startHour, endHour } from '../lib/schedule';
import { participantName } from '../lib/students';
import { classDuration, classState, isHourBlocked, stateMoneyNote } from '../lib/classMeta';
import { classRangeLabel, computeDayOverlaps, minutesToLabel, nextFreeStart, snapMinutes } from '../lib/time';
import { holidayName } from '../lib/holidays';
import { useSlideDirection } from '../hooks/useSlideDirection';
import { useDialog } from '../state/DialogContext';
import type { ClassEntry } from '../types';

interface WeeklyViewProps {
  anchor: Date;
  onChangeAnchor: (d: Date) => void;
  onOpenNewClass: (day: string, start: number) => void;
  onOpenEditClass: (day: string, start: number, entry: ClassEntry) => void;
  onOpenCopyWeek: (fromMonday: Date) => void;
  onBlockDay: (day: string) => void;
}

/** Alto de una hora en la grilla, en px. La altura de cada clase es proporcional a su duración. */
const HOUR_PX = 56;
const PX_PER_MIN = HOUR_PX / 60;

/**
 * Vista semanal como CALENDARIO de tiempo real (v10): 7 columnas (días) sobre un eje de
 * horas continuo. Cada clase es un bloque ubicado en su horario exacto y con altura
 * proporcional a su duración. Tocar un hueco crea una clase a esa hora; arrastrar un
 * bloque la reprograma. No se permite dejar clases superpuestas.
 */
export default function WeeklyView({
  anchor,
  onChangeAnchor,
  onOpenNewClass,
  onOpenEditClass,
  onOpenCopyWeek,
  onBlockDay,
}: WeeklyViewProps) {
  const { data, ledger, moveClass } = useAgenda();
  const dialog = useDialog();
  const monday = startOfWeek(anchor);
  const slideDir = useSlideDirection(monday.getTime());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekKeys = weekDays.map((d) => dayKey(d));

  // Rango de horas a mostrar: el horario configurado, ampliado si alguna clase o bloqueo
  // de la semana cae fuera (salvaguarda: nunca se esconde una clase por estar fuera de rango).
  const sh = startHour(data.settings);
  const eh = endHour(data.settings);
  let minMin = sh * 60;
  let maxMin = (eh + 1) * 60; // eh es la última hora de INICIO; el día llega hasta eh+1
  for (const key of weekKeys) {
    const slots = data.days[key];
    if (slots) {
      for (const [startStr, entry] of Object.entries(slots)) {
        const st = Number(startStr);
        // Defensa: una hora imposible (fuera de 0..1439) NO debe agrandar la grilla. La
        // reparación (lib/migrate) ya sana estos datos, pero por si acaso no inflamos filas.
        if (!Number.isFinite(st) || st < 0 || st >= 24 * 60) continue;
        minMin = Math.min(minMin, st);
        maxMin = Math.max(maxMin, st + classDuration(entry));
      }
    }
    const block = data.blocks[key];
    if (block?.hours) {
      for (const h of block.hours) {
        minMin = Math.min(minMin, h * 60);
        maxMin = Math.max(maxMin, (h + 1) * 60);
      }
    }
  }
  // El rango de la grilla nunca sale de un día real (0 a 24 h): así no aparecen "horas 480".
  minMin = Math.max(0, minMin);
  maxMin = Math.min(24 * 60, maxMin);
  const gridStartMin = Math.floor(minMin / 60) * 60;
  const gridEndMin = Math.ceil(maxMin / 60) * 60;
  const totalPx = (gridEndMin - gridStartMin) * PX_PER_MIN;
  const hourList: number[] = [];
  for (let h = gridStartMin / 60; h < gridEndMin / 60; h++) hourList.push(h);

  // Solapamientos por día (marca informativa; el modelo nuevo no deja crear/mover a un rango
  // ocupado, pero pueden existir en datos migrados de versiones viejas).
  const overlapsByDay: Record<string, Set<number>> = {};
  for (const key of weekKeys) overlapsByDay[key] = computeDayOverlaps(data.days[key]);

  const [showFree, setShowFree] = useState(false);
  // Origen del arrastre (para reprogramar moviendo).
  const [drag, setDrag] = useState<{ day: string; start: number } | null>(null);

  function goToWeek(offsetWeeks: number) {
    onChangeAnchor(addDays(anchor, offsetWeeks * 7));
  }

  /** Minutos (redondeados a 15) bajo la posición del click/drop dentro de una columna. */
  function minutesAt(clientY: number, colTop: number): number {
    const raw = gridStartMin + (clientY - colTop) / PX_PER_MIN;
    const snapped = snapMinutes(raw);
    return Math.max(gridStartMin, Math.min(gridEndMin - 15, snapped));
  }

  function handleColumnClick(e: MouseEvent<HTMLDivElement>, day: string) {
    // Solo si se tocó el fondo de la columna (no un bloque de clase, que hace stopPropagation).
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenNewClass(day, minutesAt(e.clientY, rect.top));
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, day: string) {
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const to = { day, start: minutesAt(e.clientY, rect.top) };
    const entry = data.days[drag.day]?.[String(drag.start)];
    const ok = moveClass(drag, to);
    if (!ok && entry) {
      const excludeStart = to.day === drag.day ? drag.start : undefined;
      const suggestion = nextFreeStart(data.days[to.day], to.start, classDuration(entry), excludeStart);
      void dialog.alert(
        'No se puede: se solapa con otra clase.' +
          (suggestion != null ? ` Probá desde las ${minutesToLabel(suggestion)}.` : '')
      );
    }
    setDrag(null);
  }

  return (
    <div className="weekly-view">
      <div className="weekly-view__nav">
        <button className="btn btn--ghost" onClick={() => goToWeek(-1)}>
          ← Semana anterior
        </button>
        <button className="btn" onClick={() => onChangeAnchor(new Date())}>
          Hoy
        </button>
        <button className="btn btn--ghost" onClick={() => goToWeek(1)}>
          Semana siguiente →
        </button>
        <button className="btn btn--ghost" onClick={() => onOpenCopyWeek(monday)}>
          ⧉ Copiar semana
        </button>
        <button
          className={`btn btn--ghost${showFree ? ' btn--active' : ''}`}
          onClick={() => setShowFree((v) => !v)}
        >
          {showFree ? '✓ Huecos libres' : 'Ver huecos'}
        </button>
      </div>

      <p className="weekly-view__hint">Tocá un hueco para agregar una clase · arrastrá una clase para reprogramarla.</p>

      <div className={`week-cal period-slide period-slide--${slideDir}`} key={monday.getTime()}>
        {/* Encabezado: esquina del eje + los 7 días. */}
        <div className="week-cal__head">
          <div className="week-cal__corner" />
          {weekDays.map((date) => {
            const key = dayKey(date);
            const total = dayTotals(data, ledger, key);
            const holiday = holidayName(key);
            const block = data.blocks[key];
            return (
              <div key={key} className={`week-cal__day-head${isToday(date) ? ' week-cal__day-head--today' : ''}`}>
                <span className="week-grid__head-dow">{WEEKDAY_NAMES_LONG[date.getDay()]}</span>
                <span className="week-grid__head-date">
                  {date.getDate()}/{date.getMonth() + 1}
                </span>
                <span className="week-grid__head-total">{formatCurrency(total.total)}</span>
                <div className="week-grid__head-marks">
                  {holiday && <span className="mark mark--holiday" title={`Feriado: ${holiday}`}>🎉</span>}
                  {block?.fullDay && <span className="mark mark--block" title={block.reason || 'Día bloqueado'}>🚫</span>}
                  <button className="mark mark--btn" title="Bloquear / liberar" onClick={() => onBlockDay(key)}>
                    🔒
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cuerpo: eje de horas + 7 columnas de día con los bloques de clase. */}
        <div className={`week-cal__body${showFree ? ' week-cal__body--free' : ''}`}>
          <div className="week-cal__axis" style={{ height: totalPx }}>
            {hourList.map((h) => (
              <div key={h} className="week-cal__axis-hour" style={{ height: HOUR_PX }}>
                {h}:00
              </div>
            ))}
          </div>

          {weekDays.map((date) => {
            const key = dayKey(date);
            const slots = data.days[key];
            const block = data.blocks[key];
            const entries = slots ? Object.entries(slots) : [];
            return (
              <div
                key={key}
                className={`week-cal__col${isToday(date) ? ' week-cal__col--today' : ''}`}
                style={{
                  height: totalPx,
                  // Líneas de hora de fondo (una cada HOUR_PX).
                  backgroundSize: `100% ${HOUR_PX}px`,
                }}
                onClick={(e) => handleColumnClick(e, key)}
                onDragOver={(e) => {
                  if (drag) e.preventDefault();
                }}
                onDrop={(e) => handleDrop(e, key)}
              >
                {/* Bandas de bloqueo (día completo o franjas puntuales). No capturan el click. */}
                {block?.fullDay ? (
                  <div className="week-cal__block-band" style={{ top: 0, height: totalPx }} title={block.reason || 'Bloqueado'} />
                ) : (
                  block?.hours?.map((h) => {
                    if (h * 60 < gridStartMin || h * 60 >= gridEndMin) return null;
                    return (
                      <div
                        key={`b-${h}`}
                        className="week-cal__block-band"
                        style={{ top: (h * 60 - gridStartMin) * PX_PER_MIN, height: HOUR_PX }}
                        title={block.reason || 'Bloqueado'}
                      />
                    );
                  })
                )}

                {entries.map(([startStr, entry]) => {
                  const start = Number(startStr);
                  // Defensa: no dibujar una clase con hora imposible en una posición absurda.
                  if (!Number.isFinite(start) || start < 0 || start >= 24 * 60) return null;
                  const dur = classDuration(entry);
                  const state = classState(entry);
                  const status = classStatus(ledger, key, start);
                  const moneyNote = stateMoneyNote(state);
                  const overlapped = overlapsByDay[key].has(start);
                  const top = (start - gridStartMin) * PX_PER_MIN;
                  const height = Math.max(20, dur * PX_PER_MIN);
                  const blockedStart = isHourBlocked(block, Math.floor(start / 60));
                  return (
                    <button
                      key={start}
                      className={`cal-event cal-event--${entry.type} cal-event--${status} cal-event--state-${state}${
                        overlapped ? ' cal-event--overlap' : ''
                      }${blockedStart ? ' cal-event--on-block' : ''}`}
                      style={{ top, height }}
                      draggable
                      onDragStart={() => setDrag({ day: key, start })}
                      onDragEnd={() => setDrag(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEditClass(key, start, entry);
                      }}
                    >
                      {overlapped && (
                        <span className="cal-event__overlap" title="Se solapa en el horario con otra clase del día">
                          ⚠
                        </span>
                      )}
                      <span className="cal-event__time">{classRangeLabel(start, entry)}</span>
                      <span className="cal-event__type">
                        {entry.type === 'indiv'
                          ? CLASS_TYPE_LABEL.indiv
                          : `${entry.participants.length} · ${CLASS_TYPE_LABEL[entry.type]}`}
                        {state !== 'confirmada' && <span className="cal-event__state"> · {state}</span>}
                      </span>
                      <span className="cal-event__names">
                        {entry.type === 'indiv'
                          ? entry.participants[0]
                            ? participantName(entry.participants[0], data.students)
                            : '—'
                          : `${entry.participants.length} alumnos`}
                      </span>
                      {moneyNote && (
                        <span className={`cal-event__money-note cal-event__money-note--${moneyNote.kind}`}>
                          {moneyNote.text}
                        </span>
                      )}
                      <span className="cal-event__price">{formatCurrency(entry.price)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
