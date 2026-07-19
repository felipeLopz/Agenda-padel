import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { useDialog } from '../state/DialogContext';
import { WEEKDAY_NAMES_LONG } from '../lib/constants';
import { isoToDayKey, parseDayKey } from '../lib/date';
import { dayKeyToISO } from '../lib/money';
import { classNames } from '../lib/students';
import { slotsForDay } from '../lib/series';
import { classRangeLabel } from '../lib/time';

interface EndSeriesModalProps {
  day: string;
  /** Hora de inicio del turno en minutos (v10). */
  start: number;
  onClose: () => void;
}

/**
 * Termina una serie DESDE una fecha: borra las clases de la serie de esa fecha en adelante y
 * conserva TODO lo anterior (pagos, asistencia e historial sin tocar). Sirve para el caso
 * típico: el alumno avisa que no viene más a partir de tal día, pero lo que ya pasó queda.
 *
 * Por defecto la fecha de corte es la de ESTA clase, que es lo más común ("de acá en
 * adelante"), pero se puede elegir cualquier otra.
 */
export default function EndSeriesModal({ day, start, onClose }: EndSeriesModalProps) {
  const { data, endSeriesFrom } = useAgenda();
  const dialog = useDialog();
  // La clase puede ser real o una repetición todavía virtual: las dos sirven para cortar.
  const entry = slotsForDay(data, day)?.[String(start)];
  // La fecha se maneja en ISO porque es lo que usa <input type="date">; se convierte a clave
  // de día recién al cortar.
  const [cutIso, setCutIso] = useState(() => dayKeyToISO(day));

  if (!entry?.seriesId) {
    onClose();
    return null;
  }
  const seriesId = entry.seriesId;

  const date = parseDayKey(day);
  const label = classNames(entry, data.students).join(', ') || `${entry.participants.length} alumno(s)`;

  // Vista previa del corte: cuántas clases YA DICTADAS se borran, cuántas quedan intactas y
  // cuántas de las que se borran tienen plata cobrada. Se calcula con la misma comparación
  // por timestamp que usa el reducer, así lo que se anuncia es exactamente lo que va a pasar.
  const cutTime = parseDayKey(isoToDayKey(cutIso)).getTime();
  let toRemove = 0;
  let toKeep = 0;
  let removedWithMoney = 0;
  for (const [d, slots] of Object.entries(data.days)) {
    const dTime = parseDayKey(d).getTime();
    for (const [sStr, e] of Object.entries(slots)) {
      if (e.seriesId !== seriesId) continue;
      if (dTime >= cutTime) {
        toRemove += 1;
        // ¿Esta clase tiene algún pago atado? Se avisa antes de borrarla.
        const hasMoney = Object.values(data.payments).some(
          (p) => p.classRef && p.classRef.day === d && p.classRef.start === Number(sStr)
        );
        if (hasMoney) removedWithMoney += 1;
      } else toKeep += 1;
    }
  }
  // Si es una serie viva, además de borrar lo materializado se apagan las repeticiones
  // futuras (que no existen como filas y por eso no se cuentan arriba).
  const isLive = Boolean(data.series[seriesId]);

  async function handleEnd() {
    const fromDay = isoToDayKey(cutIso);
    if (toRemove === 0 && !isLive) {
      void dialog.alert('No hay clases de esta serie desde esa fecha en adelante. Probá con una fecha anterior.');
      return;
    }
    let msg = isLive
      ? 'La serie deja de repetirse desde esa fecha en adelante. '
      : '';
    if (toRemove > 0) msg += `Se van a borrar ${toRemove} clase(s) ya cargada(s) desde esa fecha. `;
    if (removedWithMoney > 0) {
      msg += `OJO: ${removedWithMoney} de esas tiene(n) plata cobrada; el pago NO se pierde, queda como saldo a favor del alumno. `;
    }
    msg += `Las ${toKeep} anteriores quedan intactas, con sus pagos y su asistencia. ¿Terminar la serie?`;
    const ok = await dialog.confirm(msg, { danger: true, confirmLabel: 'Terminar la serie' });
    if (!ok) return;
    const res = endSeriesFrom(seriesId, fromDay);
    void dialog.alert(
      `Serie terminada${isLive ? ' (no se repite más desde esa fecha)' : ''}: se borraron ${res.removed} clase(s). ` +
        `Quedaron ${res.kept} clase(s) anteriores sin ningún cambio.`
    );
    onClose();
  }

  return (
    <Modal title="Terminar la serie desde una fecha" onClose={onClose}>
      <div className="class-form">
        <p className="settings__hint">
          Serie de «{label}» ({WEEKDAY_NAMES_LONG[date.getDay()]} · {classRangeLabel(start, entry)}). Elegí desde qué
          fecha NO se dicta más: se borran las clases de la serie de esa fecha en adelante y{' '}
          <strong>todo lo anterior queda igual</strong> — pagos, deudas, asistencia e historial no se tocan.
        </p>

        <div className="recurrence">
          <div className="recurrence__row">
            <span>Desde el</span>
            <input type="date" value={cutIso} onChange={(e) => setCutIso(e.target.value)} />
          </div>
          <span className="discount-editor__hint">
            {isLive && 'Deja de repetirse desde esa fecha. '}
            Se borran {toRemove} clase(s) ya cargada(s). Quedan {toKeep} anteriores sin tocar.
            {removedWithMoney > 0 && ` ${removedWithMoney} de las que se borran tiene(n) plata cobrada (queda como saldo a favor).`}
          </span>
        </div>

        <div className="class-form__actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--danger" onClick={handleEnd} disabled={toRemove === 0 && !isLive}>
            Terminar la serie
          </button>
        </div>
      </div>
    </Modal>
  );
}
