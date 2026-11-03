export function Brand({ size = 'md', showCountry = true }) {
  return (
    <span className={`brand brand-${size}`}>
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-triangle" />
      </span>
      <span className="brand-word">YouTube</span>
      {showCountry && <span className="brand-country">IN</span>}
    </span>
  );
}
