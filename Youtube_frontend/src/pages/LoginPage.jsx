import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Globe2,
  Languages,
  Loader2,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getErrorMessage } from '../lib/api.js';
import { LANGUAGES } from '../lib/languages.js';
import Logo from '../components/Logo.jsx';
import { OtpModal } from '../components/OtpModal.jsx';

const DEMO_ACCOUNTS = [
  { label: 'Alex', email: 'alex@example.com', password: 'password123', detail: 'English · New York', tone: 'blue' },
  { label: 'Priya', email: 'priya@example.com', password: 'password123', detail: 'Hindi · Mumbai', tone: 'violet' },
  { label: 'Sofia', email: 'sofia@example.com', password: 'password123', detail: 'Spanish · Madrid', tone: 'rose' },
  { label: 'Admin', email: 'admin@example.com', password: 'admin1234', detail: 'Admin · YouTube', tone: 'amber' },
];

export default function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    username: '',
    location: '',
    preferredLanguage: 'en',
  });
  const [submitting, setSubmitting] = useState(false);
  const [quickAccount, setQuickAccount] = useState('');
  const [error, setError] = useState('');
  const [pendingOtp, setPendingOtp] = useState(null);

  useEffect(() => {
    if (user && !loading) navigate('/watch', { replace: true });
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="login-loading">
        <Loader2 size={26} className="spin" />
        Loading your account…
      </div>
    );
  }

  if (user) return <Navigate to="/watch" replace />;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'login') {
        const data = await login(form.email, form.password);
        if (data?.requiresOtp) {
          setPendingOtp(data);
          return;
        }
        toast.success('Welcome back.');
      } else {
        await register({
          username: form.username,
          email: form.email,
          password: form.password,
          location: form.location,
          preferredLanguage: form.preferredLanguage,
        });
        toast.success('Your account is ready.');
      }
      navigate('/watch');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickLogin(account) {
    setQuickAccount(account.email);
    setError('');
    try {
      const data = await login(account.email, account.password);
      if (data?.requiresOtp) {
        setPendingOtp(data);
        return;
      }
      toast.success(`Signed in as ${account.label}.`);
      navigate('/watch');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setQuickAccount('');
    }
  }

  return (
    <div className="login-page">
      <div className="login-visual">
        <div className="login-visual-top">
          <Logo />
          <Link to="/watch" className="back-link">
            <ArrowLeft size={16} />
            Back to video
          </Link>
        </div>

        <div className="login-hero-copy">
          <span className="eyebrow">
            <Sparkles size={15} />
            One conversation, every language
          </span>
          <h1>
            Talk across borders.
            <br />
            <span>Translate in one click.</span>
          </h1>
          <p>
            A YouTube-style commenting platform with mentions, reactions, reports, moderation
            history, and instant translation built for a global community.
          </p>
        </div>

        <div className="comment-preview-stack" aria-hidden="true">
          <div className="preview-comment preview-one">
            <span className="preview-avatar">P</span>
            <div>
              <strong>priya</strong>
              <p>यह वीडियो बहुत शानदार है! धन्यवाद!</p>
              <span className="preview-translate">
                <Languages size={12} />
                Translated to English
              </span>
            </div>
          </div>
          <div className="preview-comment preview-two">
            <span className="preview-avatar preview-avatar-two">S</span>
            <div>
              <strong>sofia</strong>
              <p>¡Me encanta este canal! La explicación fue muy clara.</p>
              <span className="preview-translate">
                <Languages size={12} />
                Translated to English
              </span>
            </div>
          </div>
          <div className="preview-comment preview-three">
            <span className="preview-avatar preview-avatar-three">A</span>
            <div>
              <strong>alex</strong>
              <p>Great breakdown @priya and @sofia!</p>
              <span className="preview-translate">
                <MessageCircle size={12} />
                2 replies
              </span>
            </div>
          </div>
        </div>

        <div className="login-feature-row">
          <span>
            <Globe2 size={15} />
            32 languages
          </span>
          <span>
            <ShieldCheck size={15} />
            Moderated reports
          </span>
          <span>
            <LockKeyhole size={15} />
            Rate limited
          </span>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <div className="login-mode-switch">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => {
                setMode('register');
                setError('');
              }}
            >
              Create account
            </button>
          </div>

          <div className="login-card-heading">
            <h2>{mode === 'login' ? 'Welcome back' : 'Join the conversation'}</h2>
            <p>
              {mode === 'login'
                ? 'Sign in to comment, react, translate, and report.'
                : 'Create a profile and pick the language you want translations in.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {mode === 'register' ? (
              <label className="field-label">
                Username
                <span className="input-with-icon">
                  <UserRound size={17} />
                  <input
                    value={form.username}
                    onChange={(event) => updateField('username', event.target.value)}
                    placeholder="e.g. alex_mercer"
                    autoComplete="username"
                    required
                    minLength={3}
                    maxLength={30}
                  />
                </span>
              </label>
            ) : null}

            <label className="field-label">
              Email
              <span className="input-with-icon">
                <Globe2 size={17} />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </span>
            </label>

            <label className="field-label">
              Password
              <span className="input-with-icon">
                <LockKeyhole size={17} />
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={8}
                />
              </span>
            </label>

            {mode === 'register' ? (
              <div className="register-grid">
                <label className="field-label">
                  Location
                  <input
                    value={form.location}
                    onChange={(event) => updateField('location', event.target.value)}
                    placeholder="City, Country"
                    maxLength={100}
                  />
                </label>
                <label className="field-label">
                  Translation language
                  <select
                    value={form.preferredLanguage}
                    onChange={(event) => updateField('preferredLanguage', event.target.value)}
                  >
                    {LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {error ? <div className="form-error">{error}</div> : null}

            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? <Loader2 size={18} className="spin" /> : null}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="demo-divider">
            <span>or try a demo account</span>
          </div>

          <div className="demo-accounts">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                type="button"
                key={account.email}
                className={`demo-account demo-${account.tone}`}
                onClick={() => handleQuickLogin(account)}
                disabled={Boolean(quickAccount)}
              >
                <span className="demo-avatar">{account.label[0]}</span>
                <span>
                  <strong>{account.label}</strong>
                  <small>{account.detail}</small>
                </span>
                {quickAccount === account.email ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <span className="demo-arrow">→</span>
                )}
              </button>
            ))}
          </div>

          <p className="login-note">
            Demo accounts use seeded data. Reports and moderation actions are visible in the
            Moderation Center.
          </p>
        </div>
      </div>

      {pendingOtp ? (
        <OtpModal
          payload={pendingOtp}
          onClose={() => setPendingOtp(null)}
          onSuccess={() => {
            setPendingOtp(null);
            navigate('/watch');
          }}
        />
      ) : null}
    </div>
  );
}
