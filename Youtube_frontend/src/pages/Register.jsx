import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { Brand } from '../components/Brand.jsx';
import { Alert, Spinner } from '../components/Ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../lib/api.js';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setBusy(true);
    try {
      const data = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        password: form.password
      });
      navigate('/login', { replace: true, state: { message: data.message } });
    } catch (err) {
      setError(getApiError(err, 'Unable to create your account. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="auth-visual-glow" />
        <div className="auth-brand">
          <Brand size="lg" />
        </div>
        <div className="auth-copy">
          <span className="auth-eyebrow">
            <Sparkles size={15} /> Create your security-first account
          </span>
          <h1>
            One account.
            <br />
            Every sign-in accounted for.
          </h1>
          <p>
            Register with your email and mobile number so YouTube can challenge unfamiliar logins
            before they reach your account.
          </p>
          <ul className="auth-checks">
            <li>
              <Check size={16} /> Login-time automatic theme
            </li>
            <li>
              <Check size={16} /> OTP on new browsers, devices, IPs and locations
            </li>
            <li>
              <Check size={16} /> 30-day trusted devices (configurable)
            </li>
            <li>
              <Check size={16} /> Review and revoke sessions any time
            </li>
          </ul>
        </div>
        <div className="auth-visual-foot">
          <Fingerprint size={15} /> Your login history is private to your account.
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-brand">
          <Brand size="lg" />
        </div>
        <div className="auth-card">
          <div className="auth-card-head">
            <h2>Create account</h2>
            <p>Set up secure access in less than a minute.</p>
          </div>

          <form onSubmit={submit} className="stack">
            <label className="field">
              <span className="field-label">Full name</span>
              <input
                value={form.name}
                onChange={update('name')}
                placeholder="Aarav Sharma"
                autoComplete="name"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Email address</span>
              <input
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">
                Mobile number <em>optional</em>
              </span>
              <input
                value={form.mobile}
                onChange={update('mobile')}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={13}
              />
              <span className="field-hint">Used only for SMS OTP fallback and security alerts.</span>
            </label>

            <div className="form-row">
              <label className="field">
                <span className="field-label">Password</span>
                <span className="password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={update('password')}
                    placeholder="8+ characters"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="icon-btn tiny password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              <label className="field">
                <span className="field-label">Confirm password</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={update('confirm')}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                />
              </label>
            </div>

            {error && <Alert tone="danger">{error}</Alert>}

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? <Spinner /> : <ShieldCheck size={18} />}
              {busy ? 'Creating account…' : 'Create secure account'}
            </button>
          </form>

          <p className="auth-switch">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </div>
        <p className="auth-legal">
          By continuing you agree to secure login verification and audit logging.
        </p>
      </section>
    </div>
  );
}
