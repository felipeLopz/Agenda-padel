import { useState } from 'react';
import { useAgenda } from '../state/AgendaContext';
import { BACKUP_REMINDER_DAYS } from '../lib/constants';

/** Días transcurridos desde una fecha ISO (o Infinity si no hay). */
function daysSince(iso: string | undefined): number {
  if (!iso) return Infinity;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Infinity;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

/**
 * Banner que recuerda hacer un backup si hace más de N días que no se exporta.
 * No guarda copias: solo empuja a descargar el JSON manual (más simple y confiable).
 */
export default function ExportReminder() {
  const { data, exportData } = useAgenda();
  const [dismissed, setDismissed] = useState(false);

  const days = daysSince(data.settings.lastExportAt);
  // Solo tiene sentido si hay datos que perder.
  const hasData = Object.keys(data.days).length > 0 || Object.keys(data.students).length > 0;
  if (dismissed || !hasData || days < BACKUP_REMINDER_DAYS) return null;

  const never = !data.settings.lastExportAt;

  return (
    <div className="export-reminder">
      <span>
        💾 {never ? 'No hiciste ningún respaldo todavía.' : `Hace ${Math.floor(days)} días que no hacés un respaldo.`}{' '}
        Descargá una copia para no perder los datos.
      </span>
      <div className="export-reminder__actions">
        <button className="btn btn--small btn--primary" onClick={() => exportData()}>
          ⬇ Exportar ahora
        </button>
        <button className="btn btn--small btn--ghost" onClick={() => setDismissed(true)}>
          Después
        </button>
      </div>
    </div>
  );
}
