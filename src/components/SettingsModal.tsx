import { useRef, useState, type ChangeEvent } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { newId } from '../lib/id';
import type { PaymentMethod } from '../types';

interface SettingsModalProps {
  onClose: () => void;
}

/** Precios, medios de pago, ajustes de packs y respaldo (exportar/importar JSON). */
export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { data, setPrices, setPaymentMethods, setSettings, exportData, importData } = useAgenda();
  const [grupal, setGrupal] = useState(data.prices.grupal);
  const [indiv, setIndiv] = useState(data.prices.indiv);
  const [methods, setMethods] = useState<PaymentMethod[]>(data.paymentMethods);
  const [defaultMethodId, setDefaultMethodId] = useState(data.settings.defaultMethodId);
  const [packLow, setPackLow] = useState(data.settings.packLowThreshold);
  const [newMethod, setNewMethod] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addMethod() {
    const label = newMethod.trim();
    if (!label) return;
    setMethods([...methods, { id: newId(), label }]);
    setNewMethod('');
  }

  function renameMethod(id: string, label: string) {
    setMethods(methods.map((m) => (m.id === id ? { ...m, label } : m)));
  }

  function removeMethod(id: string) {
    if (methods.length === 1) {
      alert('Tiene que quedar al menos un medio de pago.');
      return;
    }
    const next = methods.filter((m) => m.id !== id);
    setMethods(next);
    if (defaultMethodId === id) setDefaultMethodId(next[0].id);
  }

  function handleSave() {
    setPrices({ grupal: Number(grupal) || 0, indiv: Number(indiv) || 0 });
    const cleanMethods = methods.filter((m) => m.label.trim());
    setPaymentMethods(cleanMethods);
    const validDefault = cleanMethods.some((m) => m.id === defaultMethodId)
      ? defaultMethodId
      : cleanMethods[0].id;
    setSettings({ defaultMethodId: validDefault, packLowThreshold: Number(packLow) || 0 });
    onClose();
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Importar reemplazará todos los datos actuales de este dispositivo. ¿Continuar?')) {
      e.target.value = '';
      return;
    }
    try {
      await importData(file);
      alert('Datos importados correctamente.');
      onClose();
    } catch {
      alert('El archivo no tiene un formato JSON válido.');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <Modal title="Configuración" onClose={onClose}>
      <div className="settings">
        <div className="class-form__row class-form__row--split">
          <div>
            <label>Precio grupal (por alumno)</label>
            <input type="number" value={grupal} onChange={(e) => setGrupal(Number(e.target.value))} />
          </div>
          <div>
            <label>Precio individual (por clase)</label>
            <input type="number" value={indiv} onChange={(e) => setIndiv(Number(e.target.value))} />
          </div>
        </div>

        <hr className="settings__divider" />

        <div className="settings__methods">
          <h3>Medios de pago</h3>
          {methods.map((m) => (
            <div key={m.id} className="method-row">
              <input type="text" value={m.label} onChange={(e) => renameMethod(m.id, e.target.value)} />
              <label className="method-row__default">
                <input
                  type="radio"
                  name="defaultMethod"
                  checked={defaultMethodId === m.id}
                  onChange={() => setDefaultMethodId(m.id)}
                />
                por defecto
              </label>
              <button className="icon-btn icon-btn--danger" onClick={() => removeMethod(m.id)} aria-label="Quitar medio">
                ✕
              </button>
            </div>
          ))}
          <div className="tag-editor__input">
            <input
              type="text"
              value={newMethod}
              placeholder="Nuevo medio (ej: débito)"
              onChange={(e) => setNewMethod(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addMethod();
                }
              }}
            />
            <button className="btn btn--ghost btn--small" onClick={addMethod}>
              + Agregar
            </button>
          </div>
        </div>

        <div className="class-form__row">
          <label>Avisar cuando al pack le queden ≤ estas clases</label>
          <input type="number" min={0} value={packLow} onChange={(e) => setPackLow(Number(e.target.value))} />
        </div>

        <div className="class-form__actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleSave}>
            Guardar
          </button>
        </div>

        <hr className="settings__divider" />

        <div className="settings__backup">
          <h3>Respaldo de datos</h3>
          <p className="settings__hint">
            Exportá un archivo JSON con clases, alumnos, pagos, packs y gastos, o importá uno para restaurar un
            respaldo (compatible con los formatos viejos v1 y v2).
          </p>
          <div className="settings__backup-actions">
            <button className="btn" onClick={exportData}>
              ⬇ Exportar JSON
            </button>
            <button className="btn btn--ghost" onClick={() => fileInputRef.current?.click()}>
              ⬆ Importar JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
