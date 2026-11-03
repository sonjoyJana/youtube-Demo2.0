import { useEffect, useState } from 'react';
import { Check, Clock3, Monitor, Moon, Palette, Smartphone, Sun, UserRound } from 'lucide-react';
import { api, getApiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { Alert, Spinner } from '../components/Ui.jsx';
import { SecurityTabs } from '../components/SecurityTabs.jsx';

const options = [
  {
    value: 'auto',
    title: 'Automatic',
    icon: Clock3,
    description:
      'Light theme for sign-ins between 5:00 AM and 12:00 PM IST; dark theme at all other times.'
  },
  {
    value: 'light',
    title: 'Light',
    icon: Sun,
    description: 'Always use the bright YouTube-style light interface.'
  },
  {
    value: 'dark',
    title: 'Dark',
    icon: Moon,
    description: 'Always use the classic dark interface.'
  }
];

export default function Appearance() {
  const { user, refreshUser } = useAuth();
  const { theme, preference, themeInfo, changePreference } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profile, setProfile] = useState({ name: user?.name || '', mobile: user?.mobile || '' });
  const [profileBusy, setProfileBusy] = useState(false);

  useEffect(() => {
    setProfile({ name: user?.name || '', mobile: user?.mobile || '' });
  }, [user?.name, user?.mobile]);

  const choose = async (value) => {
    if (value === preference || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await changePreference(value);
      setNotice(data.message);
      await refreshUser();
    } catch (err) {
      setError(getApiError(err, 'Could not update your theme.'));
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch('/profile/details', profile);
      setNotice(data.message);
      await refreshUser();
    } catch (err) {
      setError(getApiError(err, 'Could not update your profile.'));
    } finally {
      setProfileBusy(false);
    }
  };

  return (
    <div className="page appearance-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Palette size={15} /> Personalization
          </span>
          <h1>Appearance</h1>
          <p>
            YouTube adapts its theme to your login time and saves the choice in your profile, so it
            follows you across sessions and devices.
          </p>
        </div>
      </div>

      <SecurityTabs />

      {notice && <Alert tone="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert tone="danger" onClose={() => setError('')}>{error}</Alert>}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Theme preference</h2>
            <p>
              Current theme: <strong>{theme}</strong> · preference: <strong>{preference}</strong>
            </p>
          </div>
          <span className="pill-muted">
            <Clock3 size={13} /> {themeInfo?.istTime || 'IST'}
          </span>
        </div>

        <div className="theme-options">
          {options.map((option) => {
            const Icon = option.icon;
            const selected = preference === option.value;
            return (
              <button
                type="button"
                key={option.value}
                className={`theme-option ${selected ? 'selected' : ''}`}
                onClick={() => choose(option.value)}
                disabled={busy}
              >
                <div className={`theme-preview preview-${option.value}`}>
                  <span className="preview-bar" />
                  <span className="preview-nav" />
                  <span className="preview-body">
                    <span className="preview-card" />
                    <span className="preview-card wide" />
                  </span>
                  {selected && (
                    <span className="preview-check">
                      {busy ? <Spinner size={14} /> : <Check size={14} />}
                    </span>
                  )}
                </div>
                <div className="theme-option-title">
                  <Icon size={17} />
                  <strong>{option.title}</strong>
                  {selected && <span className="selected-tag">Selected</span>}
                </div>
                <p>{option.description}</p>
              </button>
            );
          })}
        </div>

        <div className="theme-rule">
          <Clock3 size={18} />
          <div>
            <strong>Login-time rule</strong>
            <span>
              5:00 AM – 12:00 PM IST → light theme · all other times → dark theme. The rule applies at
              sign-in while preference is Automatic: {themeInfo?.rule || 'Light 5 AM–12 PM IST, dark otherwise'}
            </span>
          </div>
        </div>
      </section>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Profile details</h2>
              <p>Used for OTP delivery and security notifications.</p>
            </div>
            <UserRound size={20} className="muted" />
          </div>

          <form className="stack" onSubmit={saveProfile}>
            <label className="field">
              <span className="field-label">Full name</span>
              <input
                value={profile.name}
                onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Email address</span>
              <input value={user?.email || ''} readOnly disabled />
              <span className="field-hint">Email is the primary OTP channel and cannot be changed here.</span>
            </label>
            <label className="field">
              <span className="field-label">Mobile number</span>
              <input
                value={profile.mobile}
                onChange={(event) => setProfile((current) => ({ ...current, mobile: event.target.value }))}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                maxLength={13}
              />
              <span className="field-hint">Enables SMS OTP verification as an alternative to email.</span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={profileBusy}>
              {profileBusy ? <Spinner /> : <Check size={17} />}
              {profileBusy ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>How your preference is stored</h2>
              <p>Theme settings live in your YouTube profile.</p>
            </div>
          </div>
          <ul className="info-list">
            <li>
              <Monitor size={17} />
              <div>
                <strong>Synced across devices</strong>
                <span>Your saved theme is loaded from the server on every new session.</span>
              </div>
            </li>
            <li>
              <Smartphone size={17} />
              <div>
                <strong>Instant local preview</strong>
                <span>The browser caches the last theme so the page never flashes the wrong colors.</span>
              </div>
            </li>
            <li>
              <Clock3 size={17} />
              <div>
                <strong>Automatic at sign-in</strong>
                <span>
                  While set to Automatic, each new sign-in recalculates light or dark from the IST
                  login time.
                </span>
              </div>
            </li>
            <li>
              <Palette size={17} />
              <div>
                <strong>Manual override is respected</strong>
                <span>
                  Choosing Light or Dark stores an explicit preference that persists until you change
                  it back to Automatic.
                </span>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
