import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { Modal, Spinner } from './Ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../lib/api.js';
import { formatDateTime, locationLabel } from '../lib/format.js';

const emptyDigits = () => Array(6).fill('');

export function OtpModal({ payload, onClose, onSuccess }) {
  const { verifyOtp, resendOtp } = useAuth();
  const [challenge, setChallenge] = useState(payload.challenge);
  const [login, setLogin] = useState(payload.login);
  const [reasons, setReasons] = useState(payload.login?.reasons || []);
  const [digits, setDigits] = useState(emptyDigits);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [cooldown, setCooldown] = useState(payload.challenge?.resendAfterSeconds || 30);
  const inputs = useRef([]);

  useEffect(() => {
    setChallenge(payload.challenge);
    setLogin(payload.login);
    setReasons(payload.login?.reasons || []);
    setDigits(emptyDigits());
    setError('');
    setNotice('');
    setCooldown(payload.challenge?.resendAfterSeconds || 30);
    const timer = setTimeout(() => inputs.current[0]?.focus(), 220);
    return () => clearTimeout(timer);
  }, [payload]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const code = digits.join('');
  const location = locationLabel(login?.location);
  const deviceLabel = [login?.browser?.name, login?.browser?.version].filter(Boolean).join(' ');
  const trustedDays = payload.trustedDeviceDays || 30;

  const writeDigits = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    setDigits((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      setDigits((current) => {
        const next = [...current];
        next[index - 1] = '';
        return next;
      });
    }
    if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < 5) inputs.current[index + 1]?.focus();
  };

  const handlePaste = (event) => {
    const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    event.preventDefault();
    const next = emptyDigits();
    text.split('').forEach((digit, index) => {
      next[index] = digit;
    });
    setDigits(next);
    inputs.current[Math.min(text.length, 5)]?.focus();
  };

  const fillDevOtp = () => {
    if (!challenge.devOtp) return;
    setDigits(challenge.devOtp.split(''));
    inputs.current[5]?.focus();
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (code.length !== 6) {
      setError('Enter all 6 digits of the verification code.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await verifyOtp({
        challengeId: challenge.id,
        otp: code,
        rememberDevice: remember
      });
      onSuccess?.(data);
    } catch (err) {
      const response = err?.response?.data;
      setError(getApiError(err, 'Verification failed. Please try again.'));
      if (typeof response?.attemptsRemaining === 'number') {
        setChallenge((current) => ({ ...current, attemptsRemaining: response.attemptsRemaining }));
      }
      setDigits(emptyDigits());
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async (channel) => {
    if (resendBusy) return;
    if (cooldown > 0 && channel === challenge.channel) return;
    setResendBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await resendOtp({ challengeId: challenge.id, channel });
      setChallenge(data.challenge);
      setLogin(data.login);
      setReasons(data.login?.reasons || reasons);
      setCooldown(data.challenge.resendAfterSeconds || 30);
      setDigits(emptyDigits());
      inputs.current[0]?.focus();
      setNotice(`A new code was sent to ${data.challenge.destination}.`);
    } catch (err) {
      setError(getApiError(err, 'Could not resend the code. Please try again.'));
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Verify it's you"
      subtitle={`We sent a 6-digit code to ${challenge.destination}.`}
      size="sm"
    >
      <div className="otp-hero">
        <span className="otp-hero-icon">
          <ShieldCheck size={30} />
        </span>
        <div>
          <strong>New sign-in detected</strong>
          <span>
            {deviceLabel || 'Unknown browser'}
            {login?.deviceType ? ` on ${login.deviceType}` : ''}
          </span>
        </div>
      </div>

      <div className="otp-context">
        <span>
          <MapPin size={15} /> {location}
        </span>
        <span>
          <Clock size={15} /> {formatDateTime(login?.timestamp)}
        </span>
      </div>

      {reasons?.length > 0 && (
        <div className="reason-chips">
          {reasons.map((reason) => (
            <span className="reason-chip" key={reason}>
              <AlertTriangle size={13} /> {reason}
            </span>
          ))}
        </div>
      )}

      {challenge.availableChannels?.length > 1 && (
        <div className="channel-tabs" role="tablist" aria-label="OTP delivery channel">
          <button
            type="button"
            className={challenge.channel === 'email' ? 'active' : ''}
            onClick={() => handleResend('email')}
            disabled={resendBusy}
          >
            <Mail size={16} /> Email
          </button>
          <button
            type="button"
            className={challenge.channel === 'mobile' ? 'active' : ''}
            onClick={() => handleResend('mobile')}
            disabled={resendBusy}
          >
            <Smartphone size={16} /> Mobile
          </button>
        </div>
      )}

      <form onSubmit={handleVerify} className="otp-form">
        <div className="otp-inputs" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(node) => {
                inputs.current[index] = node;
              }}
              value={digit}
              onChange={(event) => writeDigits(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              aria-label={`Digit ${index + 1}`}
              className="otp-digit"
            />
          ))}
        </div>

        <div className="otp-meta">
          <span>Expires {formatDateTime(challenge.expiresAt)}</span>
          <span>
            {challenge.attemptsRemaining} attempt{challenge.attemptsRemaining === 1 ? '' : 's'} left
          </span>
        </div>

        {challenge.devOtp && (
          <button type="button" className="dev-otp" onClick={fillDevOtp}>
            <span>Development mode</span>
            <strong>{challenge.devOtp}</strong>
            <em>Tap to autofill</em>
          </button>
        )}

        <label className="trust-toggle">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <span className="switch" aria-hidden="true" />
          <span>
            Trust this browser for {trustedDays} days
            <small>Skip OTP prompts on this device until the trust period ends.</small>
          </span>
        </label>

        {notice && (
          <div className="inline-note success">
            <CheckCircle2 size={16} /> {notice}
          </div>
        )}
        {error && (
          <div className="inline-note danger" role="alert">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <Spinner /> : <ShieldCheck size={18} />}
          {busy ? 'Verifying…' : 'Verify & continue'}
        </button>
      </form>

      <div className="otp-resend">
        <span>Didn't receive the code?</span>
        <button
          type="button"
          onClick={() => handleResend(challenge.channel)}
          disabled={cooldown > 0 || resendBusy}
        >
          {resendBusy ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </Modal>
  );
}
