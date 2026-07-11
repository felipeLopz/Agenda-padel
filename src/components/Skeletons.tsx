import Spinner from './Spinner';

/**
 * Esqueletos de carga (tarjetas grises con brillo) que se muestran mientras se bajan
 * los datos de la nube al iniciar sesión, en vez de una pantalla en blanco.
 */
export default function Skeletons() {
  return (
    <div className="skeletons" aria-hidden>
      <div className="skeletons__spinner" aria-hidden={false}>
        <Spinner label="Trayendo tus datos de la nube…" />
      </div>
      <div className="skeleton skeleton--bar" />
      <div className="skeleton-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton skeleton--card" />
        ))}
      </div>
    </div>
  );
}
