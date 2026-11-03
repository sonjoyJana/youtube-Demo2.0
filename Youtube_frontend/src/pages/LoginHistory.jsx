import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ChevronRight,
  Clock3,
  History,
  KeyRound,
  MapPin,
  Search,
  ShieldCheck,
  X
} from 'lucide-react';
import { api, getApiError } from '../lib/api.js';
import { Alert, EmptyState, InfoRow, Modal, Skeleton, Spinner, StatusPill } from '../components/Ui.jsx';
import { SecurityTabs } from '../components/SecurityTabs.jsx';
import {
  formatDateTime,
  locationLabel,
  statusMeta,
  timeAgo
} from '../lib/format.js';

const filters = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Successful' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending_otp', label: 'OTP pending' },
  { value: 'otp_locked', label: 'OTP locked' }
];

export default function LoginHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState(q);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .get('/security/logins', { params: { page: 1, limit: 20, status, q } })
      .then(({ data }) => {
        if (!active) return;
        setItems(data.items);
        setPagination(data.pagination);
        setCounts(data.counts || {});
      })
      .catch((err) => {
        if (active) setError(getApiError(err, 'Could not load login history.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status, q]);

  const total = useMemo(() => Object.values(counts).reduce((sum, value) => sum + value, 0), [counts]);

  const applySearch = (event) => {
    event.preventDefault();
    const value = search.trim();
    const next = new URLSearchParams(searchParams);
    if (value) next.set('q', value);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const clearSearch = () => {
    setSearch('');
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const loadMore = async () => {
    if (!pagination?.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get('/security/logins', {
        params: { page: pagination.page + 1, limit: pagination.limit, status, q }
      });
      setItems((current) => [...current, ...data.items]);
      setPagination(data.pagination);
    } catch (err) {
      setError(getApiError(err, 'Could not load more records.'));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="page history-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <History size={15} /> Audit trail
          </span>
          <h1>Login history</h1>
          <p>
            Every sign-in attempt with its public IP, browser, operating system, device and
            approximate location.
          </p>
        </div>
        <span className="pill-muted">{total} records</span>
      </div>

      <SecurityTabs />

      <div className="history-toolbar">
        <div className="chips-row">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`chip ${status === filter.value ? 'active' : ''}`}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
              {filter.value !== 'all' && counts[filter.value] ? (
                <em>{counts[filter.value]}</em>
              ) : null}
            </button>
          ))}
        </div>

        <form className="history-search" onSubmit={applySearch}>
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search IP, city, browser…"
            aria-label="Filter login history"
          />
          {q && (
            <button type="button" className="icon-btn tiny" onClick={clearSearch} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
          <button type="submit" className="btn btn-ghost btn-sm">
            Filter
          </button>
        </form>
      </div>

      {q && (
        <div className="filter-note">
          Showing results for <strong>“{q}”</strong>
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="panel">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} height={54} style={{ marginBottom: 10 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title="No login records found"
          text={q || status !== 'all' ? 'Try a different filter or search term.' : 'Your sign-in attempts will appear here.'}
        />
      ) : (
        <>
          <div className="panel table-panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Date &amp; time</th>
                  <th className="hide-sm">Location</th>
                  <th className="hide-md">IP address</th>
                  <th>Browser</th>
                  <th className="hide-sm">Device</th>
                  <th className="hide-md">OTP</th>
                  <th aria-label="Details" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const meta = statusMeta(item.status);
                  return (
                    <tr key={item.id} className="clickable" onClick={() => setSelected(item)}>
                      <td>
                        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                      </td>
                      <td>
                        <strong className="cell-strong">{formatDateTime(item.timestamp)}</strong>
                        <span className="cell-sub">{timeAgo(item.timestamp)}</span>
                      </td>
                      <td className="hide-sm">
                        <span className="cell-inline">
                          <MapPin size={14} /> {locationLabel(item.location)}
                        </span>
                      </td>
                      <td className="hide-md mono">{item.ip || '—'}</td>
                      <td>
                        <span className="cell-strong">
                          {item.browser.name}
                          {item.browser.version ? ` ${item.browser.version.split('.')[0]}` : ''}
                        </span>
                        <span className="cell-sub">{item.os.name}</span>
                      </td>
                      <td className="hide-sm">
                        <span className="cell-strong">{item.deviceType}</span>
                        <span className="cell-sub">{item.deviceModel || 'Model unavailable'}</span>
                      </td>
                      <td className="hide-md">
                        {item.trusted ? (
                          <span className="otp-tag trusted">
                            <ShieldCheck size={13} /> Trusted
                          </span>
                        ) : item.requiresOtp ? (
                          <span className={`otp-tag ${item.otpVerified ? 'verified' : 'pending'}`}>
                            <KeyRound size={13} />
                            {item.otpVerified ? 'Verified' : 'Required'}
                          </span>
                        ) : (
                          <span className="otp-tag muted">Not required</span>
                        )}
                      </td>
                      <td>
                        <ChevronRight size={17} className="row-chevron" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mobile-cards">
              {items.map((item) => {
                const meta = statusMeta(item.status);
                return (
                  <button
                    type="button"
                    className="mobile-login-card"
                    key={item.id}
                    onClick={() => setSelected(item)}
                  >
                    <div className="mobile-login-top">
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                      <span>{timeAgo(item.timestamp)}</span>
                    </div>
                    <strong>
                      {item.browser.name} · {item.deviceType}
                    </strong>
                    <span>
                      <MapPin size={13} /> {locationLabel(item.location)}
                    </span>
                    <span>
                      <Clock3 size={13} /> {formatDateTime(item.timestamp)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="load-more">
            <span>
              Showing {items.length} of {pagination?.total || items.length} records
            </span>
            {pagination?.hasMore && (
              <button type="button" className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Spinner /> : <ArrowDown size={16} />}
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        </>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Login details"
        subtitle={selected ? formatDateTime(selected.timestamp) : ''}
        size="md"
      >
        {selected && <LoginDetails login={selected} />}
      </Modal>
    </div>
  );
}

function LoginDetails({ login }) {
  const meta = statusMeta(login.status);
  const flags = [
    ['New browser', login.isNewBrowser],
    ['New device', login.isNewDevice],
    ['New IP address', login.isNewIp],
    ['New city / state', login.isNewLocation]
  ].filter(([, value]) => value);

  return (
    <div className="details">
      <div className="details-top">
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        <span>{timeAgo(login.timestamp)}</span>
      </div>

      {login.reasons?.length > 0 && (
        <div className="reason-chips">
          {login.reasons.map((reason) => (
            <span className="reason-chip" key={reason}>
              {reason}
            </span>
          ))}
        </div>
      )}

      <div className="details-grid">
        <InfoRow label="Public IP" mono>
          {login.ip}
        </InfoRow>
        <InfoRow label="Approx. location">{locationLabel(login.location)}</InfoRow>
        <InfoRow label="City">{login.location?.city}</InfoRow>
        <InfoRow label="State">{login.location?.state}</InfoRow>
        <InfoRow label="Country">{login.location?.country}</InfoRow>
        <InfoRow label="Coordinates" mono>
          {login.location?.latitude != null && login.location?.longitude != null
            ? `${login.location.latitude.toFixed(4)}, ${login.location.longitude.toFixed(4)}`
            : '—'}
        </InfoRow>
        <InfoRow label="Browser">
          {login.browser.name} {login.browser.version}
        </InfoRow>
        <InfoRow label="Operating system">
          {login.os.name} {login.os.version}
        </InfoRow>
        <InfoRow label="Device type">{login.deviceType}</InfoRow>
        <InfoRow label="Device model">{login.deviceModel || 'Not available'}</InfoRow>
        <InfoRow label="OTP verification">
          {login.requiresOtp
            ? login.otpVerified
              ? 'Verified successfully'
              : `Required · ${login.otpAttempts} failed attempt${login.otpAttempts === 1 ? '' : 's'}`
            : 'Not required'}
        </InfoRow>
        <InfoRow label="Trusted device">{login.trusted ? 'Yes' : 'No'}</InfoRow>
      </div>

      {flags.length > 0 && (
        <div className="details-flags">
          <span className="details-label">Detection signals</span>
          <div className="reason-chips">
            {flags.map(([label]) => (
              <span className="reason-chip" key={label}>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {login.reason && (
        <div className="details-note">
          <span className="details-label">Reason</span>
          <p>{login.reason}</p>
        </div>
      )}

      <div className="details-note">
        <span className="details-label">User agent</span>
        <p className="mono small">{login.userAgent || '—'}</p>
      </div>
    </div>
  );
}
