import { useRef, useState, type ChangeEvent } from 'react';
import { newId } from '../lib/id';
import { fileToCompressedDataURL } from '../lib/image';
import { useDialog } from '../state/DialogContext';
import type { Attachment } from '../types';

interface AttachmentsEditorProps {
  attachments: Attachment[] | undefined;
  onChange: (next: Attachment[]) => void;
}

/** Normaliza un enlace de video: si no trae protocolo, le antepone https://. */
function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

/**
 * Editor de adjuntos: fotos (comprimidas y guardadas en localStorage) + videos por
 * enlace (no se sube el archivo, se pega la URL de YouTube/Drive/etc.).
 */
export default function AttachmentsEditor({ attachments, onChange }: AttachmentsEditorProps) {
  const dialog = useDialog();
  const list = attachments ?? [];
  const [videoUrl, setVideoUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const added: Attachment[] = [];
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToCompressedDataURL(file, 900, 0.72);
        added.push({ id: newId(), kind: 'foto', dataUrl, createdAt: new Date().toISOString() });
      } catch {
        void dialog.alert('No se pudo procesar una imagen.');
      }
    }
    if (added.length) onChange([...list, ...added]);
    e.target.value = '';
  }

  function addVideo() {
    const url = normalizeUrl(videoUrl);
    if (!url) return;
    onChange([...list, { id: newId(), kind: 'video', url, createdAt: new Date().toISOString() }]);
    setVideoUrl('');
  }

  function remove(id: string) {
    onChange(list.filter((a) => a.id !== id));
  }

  return (
    <div className="attach">
      <div className="attach__actions">
        <button type="button" className="btn btn--ghost btn--small" onClick={() => fileRef.current?.click()}>
          📷 Subir foto
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          style={{ display: 'none' }}
          onChange={handlePhoto}
        />
        <input
          type="url"
          className="attach__url"
          value={videoUrl}
          placeholder="Pegar enlace de video (YouTube, Drive…)"
          onChange={(e) => setVideoUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addVideo();
            }
          }}
        />
        <button type="button" className="btn btn--ghost btn--small" onClick={addVideo}>
          🔗 Agregar video
        </button>
      </div>

      {list.length > 0 && (
        <div className="attach__grid">
          {list.map((a) => (
            <div key={a.id} className={`attach__item attach__item--${a.kind}`}>
              {a.kind === 'foto' ? (
                <img src={a.dataUrl} alt="Adjunto" />
              ) : (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="attach__video">
                  ▶ Video
                </a>
              )}
              <button
                type="button"
                className="attach__remove"
                onClick={() => remove(a.id)}
                aria-label="Quitar adjunto"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
