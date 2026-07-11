/** Spinner temático: una pelotita de pádel que rebota (Tanda 3 de efectos). */
export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="padel-spinner" role="status" aria-live="polite">
      <span className="padel-spinner__ball" aria-hidden>
        🎾
      </span>
      {label && <span className="padel-spinner__label">{label}</span>}
    </div>
  );
}
