import { useEffect, useState } from 'react';
import { initials } from '../lib/format.js';

const GRADIENTS = [
  ['#7c3aed', '#db2777'],
  ['#0891b2', '#2563eb'],
  ['#ea580c', '#dc2626'],
  ['#16a34a', '#0d9488'],
  ['#9333ea', '#4f46e5'],
  ['#ca8a04', '#ea580c'],
];

function gradientFor(name) {
  const value = String(name || '?');
  const index = [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
  const [from, to] = GRADIENTS[index % GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export default function Avatar({ name = '', src = '', size = 40, className = '' }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const style = {
    width: size,
    height: size,
    minWidth: size,
    fontSize: Math.max(10, Math.round(size * 0.34)),
    background: gradientFor(name),
  };

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s profile picture` : 'Profile picture'}
        className={`avatar ${className}`}
        style={{ width: size, height: size, minWidth: size }}
        onError={() => setFailed(true)}
        loading="lazy"
      />
    );
  }

  return (
    <span
      className={`avatar avatar-fallback ${className}`}
      style={style}
      aria-label={name ? `${name}'s profile picture` : 'Profile picture'}
    >
      {initials(name) || '?'}
    </span>
  );
}
