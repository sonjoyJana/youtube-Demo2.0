import { Link } from 'react-router-dom';

export default function Logo({ compact = false }) {
  return (
    <Link to="/" className="logo" aria-label="YouTube home">
      <span className="logo-mark" aria-hidden="true">
        <span className="logo-play" />
      </span>
      {!compact ? <span className="logo-text">YouTube</span> : null}
    </Link>
  );
}
