import { useEffect, useState } from 'react';
import {
  Laptop,
  MapPin,
  MonitorSmartphone,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2
} from 'lucide-react';
import { api, getApiError } from '../lib/api.js';
import { Alert, EmptyState, Modal, Skeleton, Spinner, StatusPill } from '../components/Ui.jsx';
import { SecurityTabs } from '../components/SecurityTabs.jsx';
import { formatDateTime, locationLabel, timeAgo } from '../lib/format.js';

function DeviceIcon({ type }) {
  if (type === 'Mobile') return <Smartphone size={24} />;
  if (type === 'Tablet') return <Tablet size={24} />;
  return <Laptop size={24} />;
}

export default function TrustedDevices() {
  const [items, setItems] = useState([]);
  const [policy, setPolicy] = useState({ trustedDeviceDays: 30 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/security/trusted-devices')
      .then(({ data }) => {
        setItems(data.items);
        setPolicy(data.policy);
        setError('');
      })
      .catch((err) => setError(getApiError(err, 'Could not load trusted devices.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async () => {
    if (!confirming) return;
    setRemoving(true);
    try {
      const { data } = await api.delete(`/security/trusted-devices/${confirming.id}`);
      setItems((current) => current.filter((item) => item.id !== confirming.id));
      setNotice(data.message);
      setConfirming(null);
    } catch (err) {
      setError(getApiError(err, 'Could not remove this trusted device.'));
      setConfirming(null);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="page devices-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <MonitorSmartphone size={15} /> Device trust
          </span>
          <h1>Trusted devices</h1>
          <p>
            Browsers verified with an OTP can skip repeated prompts for {policy.trustedDeviceDays}{' '}
            days. Remove trust if a device is lost or shared.
          </p>
        </div>
        <StatusPill tone="success">{items.length} trusted</StatusPill>
      </div>

      <SecurityTabs />

      <div className="policy-banner">
        <span className="policy-icon">
          <ShieldCheck size={22} />
        </span>
        <div>
          <strong>Trust window: {policy.trustedDeviceDays} days</strong>
          <span>
            Trust is granted only after a successful OTP verification. The window is configurable on
            the server with <code>TRUSTED_DEVICE_DAYS</code>.
          </span>
        </div>
      </div>

      {notice && <Alert tone="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert tone="danger" onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <div className="device-grid">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} height={270} radius={18} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={MonitorSmartphone}
          title="No trusted devices yet"
          text="Verify a new sign-in with an OTP and keep “Trust this browser” checked to add one."
        />
      ) : (
        <div className="device-grid">
          {items.map((device) => {
            const totalDays = policy.trustedDeviceDays || 30;
            const pct = Math.max(4, Math.min(100, (device.daysLeft / totalDays) * 100));
            return (
              <article className="device-card" key={device.id}>
                <div className="device-card-head">
                  <span className={`device-icon device-${device.deviceType.toLowerCase()}`}>
                    <DeviceIcon type={device.deviceType} />
                  </span>
                  <div className="device-title">
                    <strong>
                      {device.browser.name}
                      {device.browser.version ? ` ${device.browser.version.split('.')[0]}` : ''}
                    </strong>
                    <span>
                      {device.os.name} · {device.deviceType}
                    </span>
                  </div>
                  {device.current && <StatusPill tone="info">This device</StatusPill>}
                </div>

                <div className="device-meta">
                  <span>
                    <MapPin size={14} /> {locationLabel(device.location)}
                  </span>
                  <span>IP {device.ip || 'Unknown'}</span>
                  <span>Model: {device.deviceModel || 'Not available'}</span>
                </div>

                <div className="device-dates">
                  <div>
                    <span>Trusted on</span>
                    <strong>{formatDateTime(device.trustedAt)}</strong>
                  </div>
                  <div>
                    <span>Last used</span>
                    <strong>{timeAgo(device.lastUsedAt)}</strong>
                  </div>
                </div>

                <div className="trust-meter">
                  <div className="trust-meter-head">
                    <span>Trust remaining</span>
                    <strong>{device.daysLeft} days</strong>
                  </div>
                  <div className="trust-bar">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <span className="trust-expiry">Expires {formatDateTime(device.expiresAt)}</span>
                </div>

                <button
                  type="button"
                  className="btn btn-danger-ghost btn-block"
                  onClick={() => setConfirming(device)}
                >
                  <Trash2 size={16} /> Remove trust
                </button>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(confirming)}
        onClose={() => (removing ? null : setConfirming(null))}
        title="Remove trusted device?"
        subtitle={
          confirming
            ? `${confirming.browser.name} · ${confirming.deviceType} · ${locationLabel(confirming.location)}`
            : ''
        }
        size="sm"
      >
        <p className="modal-copy">
          The next sign-in from this browser will require OTP verification, even if the IP and
          location are recognized.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setConfirming(null)} disabled={removing}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={remove} disabled={removing}>
            {removing ? <Spinner /> : <Trash2 size={16} />}
            {removing ? 'Removing…' : 'Remove trust'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
