import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock3,
  Laptop,
  LogOut,
  MapPin,
  MonitorSmartphone,
  ShieldCheck,
  Smartphone,
  Tablet
} from 'lucide-react';
import { api, getApiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, EmptyState, Modal, Skeleton, Spinner, StatusPill } from '../components/Ui.jsx';
import { SecurityTabs } from '../components/SecurityTabs.jsx';
import { formatDateTime, locationLabel, timeAgo } from '../lib/format.js';

function SessionIcon({ type }) {
  if (type === 'Mobile') return <Smartphone size={22} />;
  if (type === 'Tablet') return <Tablet size={22} />;
  return <Laptop size={22} />;
}

export default function Sessions() {
  const { forceLogout } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/security/sessions')
      .then(({ data }) => {
        setItems(data.items);
        setError('');
      })
      .catch((err) => setError(getApiError(err, 'Could not load active sessions.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      const { data } = await api.delete(`/security/sessions/${confirming.id}`);
      if (data.signedOut) {
        forceLogout();
        navigate('/login', { replace: true });
        return;
      }
      setItems((current) => current.filter((item) => item.id !== confirming.id));
      setNotice(data.message);
      setConfirming(null);
    } catch (err) {
      setError(getApiError(err, 'Could not revoke this session.'));
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  };

  const revokeOthers = async () => {
    setBusy(true);
    try {
      const { data } = await api.delete('/security/sessions');
      setItems((current) => current.filter((item) => item.current));
      setNotice(data.message);
      setConfirmAll(false);
    } catch (err) {
      setError(getApiError(err, 'Could not revoke other sessions.'));
      setConfirmAll(false);
    } finally {
      setBusy(false);
    }
  };

  const otherCount = items.filter((item) => !item.current).length;

  return (
    <div className="page sessions-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <MonitorSmartphone size={15} /> Session control
          </span>
          <h1>Active sessions</h1>
          <p>
            These browsers currently hold a valid session. Revoke any session you do not recognize.
          </p>
        </div>
        {otherCount > 0 && (
          <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirmAll(true)}>
            <LogOut size={16} /> Sign out other sessions
          </button>
        )}
      </div>

      <SecurityTabs />

      {notice && <Alert tone="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert tone="danger" onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <div className="panel">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} height={82} style={{ marginBottom: 12 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Laptop}
          title="No active sessions"
          text="You will see browsers holding a valid YouTube session here."
        />
      ) : (
        <div className="session-list">
          {items.map((session) => (
            <article className={`session-card ${session.current ? 'current' : ''}`} key={session.id}>
              <span className="session-icon">
                <SessionIcon type={session.deviceType} />
              </span>

              <div className="session-main">
                <div className="session-title">
                  <strong>
                    {session.browser.name}
                    {session.browser.version ? ` ${session.browser.version.split('.')[0]}` : ''} on{' '}
                    {session.os.name}
                  </strong>
                  {session.current && <StatusPill tone="success">Current session</StatusPill>}
                  {!session.current && <StatusPill tone="info">Active</StatusPill>}
                </div>
                <div className="session-meta">
                  <span>
                    <MapPin size={14} /> {locationLabel(session.location)}
                  </span>
                  <span>IP {session.ip || 'Unknown'}</span>
                  <span>
                    {session.deviceType}
                    {session.deviceModel ? ` · ${session.deviceModel}` : ''}
                  </span>
                </div>
                <div className="session-times">
                  <span>
                    <Clock3 size={13} /> Signed in {formatDateTime(session.createdAt)}
                  </span>
                  <span>Last active {timeAgo(session.lastActiveAt)}</span>
                  <span>Expires {formatDateTime(session.expiresAt)}</span>
                </div>
              </div>

              <div className="session-actions">
                {session.current ? (
                  <span className="current-note">
                    <ShieldCheck size={15} /> This is you
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-danger-ghost btn-sm"
                    onClick={() => setConfirming(session)}
                  >
                    <LogOut size={15} /> Revoke
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(confirming)}
        onClose={() => (busy ? null : setConfirming(null))}
        title="Revoke this session?"
        subtitle={
          confirming
            ? `${confirming.browser.name} · ${confirming.deviceType} · ${locationLabel(confirming.location)}`
            : ''
        }
        size="sm"
      >
        <p className="modal-copy">
          The browser will be signed out immediately and will need to authenticate again on its next
          visit.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setConfirming(null)} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={revoke} disabled={busy}>
            {busy ? <Spinner /> : <LogOut size={16} />}
            {busy ? 'Revoking…' : 'Revoke session'}
          </button>
        </div>
      </Modal>

      <Modal
        open={confirmAll}
        onClose={() => (busy ? null : setConfirmAll(false))}
        title="Sign out other sessions?"
        subtitle={`${otherCount} other active session${otherCount === 1 ? '' : 's'}`}
        size="sm"
      >
        <p className="modal-copy">
          All browsers except this one will be signed out. They will need to complete authentication
          again.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmAll(false)} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={revokeOthers} disabled={busy}>
            {busy ? <Spinner /> : <LogOut size={16} />}
            {busy ? 'Signing out…' : 'Sign out others'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
