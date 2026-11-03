import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Fingerprint,
  History,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MonitorSmartphone,
  Palette,
  ShieldCheck,
  Sparkles,
  Smartphone,
  UserRound
} from 'lucide-react';
import { api, getApiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, EmptyState, Skeleton, StatusPill } from '../components/Ui.jsx';
import { SecurityTabs } from '../components/SecurityTabs.jsx';
import {
  EVENT_META,
  formatDateTime,
  locationLabel,
  statusMeta,
  timeAgo
} from '../lib/format.js';

const eventIcons = {
  account_created: Sparkles,
  login_success: CheckCircle2,
  login_failed: AlertTriangle,
  otp_sent: Mail,
  otp_verified: ShieldCheck,
  otp_failed: AlertTriangle,
  otp_locked: Lock,
  trusted_device_added: MonitorSmartphone,
  trusted_device_removed: MonitorSmartphone,
  session_revoked: Laptop,
  logout: LogOut,
  theme_changed: Palette,
  profile_updated: UserRound
};

export default function Security() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.get('/security/overview'), api.get('/security/events?limit=14')])
      .then(([overviewResponse, eventsResponse]) => {
        if (!active) return;
        setOverview(overviewResponse.data);
        setEvents(eventsResponse.data.items);
        setError('');
      })
      .catch((err) => {
        if (active) setError(getApiError(err, 'Could not load account security details.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="page">
        <Skeleton height={34} width={280} />
        <Skeleton height={16} width={460} style={{ marginTop: 10 }} />
        <div className="security-layout" style={{ marginTop: 24 }}>
          <Skeleton height={420} radius={18} />
          <Skeleton height={420} radius={18} />
        </div>
      </div>
    );
  }

  if (error) return <div className="page"><Alert tone="danger">{error}</Alert></div>;

  const { stats, securityScore, recentLogins, theme, policy } = overview;

  const protections = [
    {
      icon: Palette,
      title: 'Automatic login-time theme',
      description: `Light theme for sign-ins between 5:00 AM and 12:00 PM IST. Currently ${theme.theme}.`,
      status: theme.preference === 'auto' ? 'Enabled' : 'Manual override',
      tone: theme.preference === 'auto' ? 'success' : 'info',
      to: '/appearance'
    },
    {
      icon: KeyRound,
      title: 'OTP for new sign-ins',
      description: 'New browser, device, IP address, city or state triggers a one-time code.',
      status: 'Enabled',
      tone: 'success',
      to: '/history'
    },
    {
      icon: MonitorSmartphone,
      title: 'Trusted devices',
      description: `${stats.trustedDevices} device${stats.trustedDevices === 1 ? '' : 's'} can skip OTP for ${policy.trustedDeviceDays} days after verification.`,
      status: `${stats.trustedDevices} active`,
      tone: stats.trustedDevices > 0 ? 'success' : 'warning',
      to: '/devices'
    },
    {
      icon: Laptop,
      title: 'Session management',
      description: `${stats.activeSessions} active session${stats.activeSessions === 1 ? '' : 's'} across your browsers.`,
      status: `${stats.activeSessions} active`,
      tone: 'info',
      to: '/sessions'
    },
    {
      icon: History,
      title: 'Login audit trail',
      description: `${stats.totalLogins} attempt${stats.totalLogins === 1 ? '' : 's'} logged with IP, geo, browser, OS and device type.`,
      status: 'Recording',
      tone: 'success',
      to: '/history'
    },
    {
      icon: Smartphone,
      title: 'OTP delivery channels',
      description: user?.mobile
        ? 'Registered email and mobile number are both available for verification codes.'
        : 'Only email is available. Add a mobile number for SMS OTP fallback.',
      status: user?.mobile ? 'Email + SMS' : 'Email only',
      tone: user?.mobile ? 'success' : 'warning',
      to: '/appearance'
    }
  ];

  return (
    <div className="page security-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <ShieldCheck size={15} /> Account security
          </span>
          <h1>Security center</h1>
          <p>Review how your account is protected and act on anything unfamiliar.</p>
        </div>
        <Link to="/history" className="btn btn-primary">
          <History size={17} /> Login history
        </Link>
      </div>

      <SecurityTabs />

      <section className="security-hero">
        <div className="security-hero-main">
          <span className="hero-shield">
            <ShieldCheck size={38} />
          </span>
          <div>
            <span className="hero-eyebrow">Protection status</span>
            <h2>
              {securityScore.label} — {securityScore.value}/100
            </h2>
            <p>
              Last successful sign-in{' '}
              {overview.lastLogin
                ? `${timeAgo(overview.lastLogin.timestamp)} from ${locationLabel(overview.lastLogin.location)}`
                : 'has not been recorded yet'}
              . Theme follows your login window: <strong>{theme.theme}</strong> now.
            </p>
            <div className="hero-mini-stats">
              <span>
                <CheckCircle2 size={15} /> {stats.successfulLogins} successful
              </span>
              <span>
                <AlertTriangle size={15} /> {stats.failedLogins} failed
              </span>
              <span>
                <KeyRound size={15} /> {stats.otpRequired} OTP checks
              </span>
            </div>
          </div>
        </div>
        <div className="security-hero-side">
          <div className="mini-ring" style={{ background: `conic-gradient(var(--accent) ${securityScore.value * 3.6}deg, rgba(255,255,255,.14) 0deg)` }}>
            <span>{securityScore.value}</span>
          </div>
          <div>
            <strong>{securityScore.label}</strong>
            <span>Security score</span>
          </div>
        </div>
      </section>

      <div className="security-layout">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Protection checklist</h2>
              <p>The controls currently guarding your account.</p>
            </div>
          </div>
          <div className="check-list">
            {protections.map((item) => {
              const Icon = item.icon;
              return (
                <Link to={item.to} className="check-row" key={item.title}>
                  <span className="check-icon">
                    <Icon size={19} />
                  </span>
                  <div className="check-main">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                  <StatusPill tone={item.tone}>{item.status}</StatusPill>
                  <ArrowRight size={16} className="check-arrow" />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Recent sign-ins</h2>
              <p>Latest attempts in your login history.</p>
            </div>
            <Link to="/history" className="text-link">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mini-login-list">
            {recentLogins.length === 0 && (
              <EmptyState
                icon={History}
                title="No sign-ins yet"
                text="Your first login will appear here."
              />
            )}
            {recentLogins.map((login) => {
              const meta = statusMeta(login.status);
              return (
                <div className="mini-login" key={login.id}>
                  <span className={`recent-dot tone-${meta.tone}`} />
                  <div>
                    <strong>
                      {login.browser.name} · {login.deviceType}
                    </strong>
                    <span>
                      <MapPin size={13} /> {locationLabel(login.location)}
                    </span>
                    <span>
                      <Clock3 size={13} /> {formatDateTime(login.timestamp)}
                    </span>
                  </div>
                  <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                </div>
              );
            })}
          </div>
          <div className="panel-cta">
            <Fingerprint size={18} />
            <div>
              <strong>OTP verified sign-ins</strong>
              <span>
                {stats.otpRequired} verification{stats.otpRequired === 1 ? '' : 's'} requested ·{' '}
                {stats.otpFailedLast7} failed in the last 7 days
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="panel activity-panel">
        <div className="panel-head">
          <div>
            <h2>Security activity</h2>
            <p>Verification, trust and session events for your account.</p>
          </div>
          <span className="pill-muted">{events.length} recent events</span>
        </div>
        {events.length === 0 ? (
          <EmptyState icon={History} title="No activity yet" text="Security events will appear here." />
        ) : (
          <ol className="timeline">
            {events.map((event) => {
              const Icon = eventIcons[event.type] || Sparkles;
              const critical = ['otp_failed', 'otp_locked', 'login_failed'].includes(event.type);
              return (
                <li key={event.id} className={critical ? 'critical' : ''}>
                  <span className="timeline-icon">
                    <Icon size={17} />
                  </span>
                  <div className="timeline-main">
                    <div>
                      <strong>{event.message || EVENT_META[event.type]?.label || event.type}</strong>
                      <span className="timeline-type">{EVENT_META[event.type]?.label || event.type}</span>
                    </div>
                    <span>
                      {formatDateTime(event.timestamp)}
                      {event.ip ? ` · ${event.ip}` : ''}
                      {event.location?.city
                        ? ` · ${[event.location.city, event.location.state, event.location.country]
                            .filter(Boolean)
                            .join(', ')}`
                        : ''}
                    </span>
                  </div>
                  <span className="timeline-time">{timeAgo(event.timestamp)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
