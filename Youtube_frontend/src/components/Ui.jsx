import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

export function Spinner({ size = 18 }) {
  return <Loader2 className="spin" size={size} aria-hidden="true" />;
}

export function PageLoading({ label = 'Loading…' }) {
  return (
    <div className="page-loading">
      <Spinner size={28} />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-icon">
          <Icon size={28} />
        </div>
      )}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Alert({ tone = 'info', children, onClose }) {
  const Icon = tone === 'danger' ? AlertTriangle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div className={`alert alert-${tone}`} role="status">
      <Icon size={18} />
      <div className="alert-body">{children}</div>
      {onClose && (
        <button type="button" className="icon-btn tiny" onClick={onClose} aria-label="Dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function StatusPill({ tone = 'muted', children, dot = true }) {
  return (
    <span className={`status-pill tone-${tone}`}>
      {dot && <span className="status-dot" />}
      {children}
    </span>
  );
}

export function Skeleton({ width = '100%', height = 16, radius = 8, style }) {
  return (
    <span
      className="skeleton"
      style={{ width, height, borderRadius: radius, display: 'block', ...style }}
    />
  );
}

export function Modal({ open, onClose, title, subtitle, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
              <X size={20} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function InfoRow({ label, children, mono = false }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className={`info-value ${mono ? 'mono' : ''}`}>{children || '—'}</span>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
