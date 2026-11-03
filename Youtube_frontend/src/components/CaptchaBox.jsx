import { RefreshCw, ShieldCheck } from 'lucide-react';

export default function CaptchaBox({ challenge, answer, onAnswerChange, onRefresh, refreshing }) {
  if (!challenge) return null;

  return (
    <div className="captcha-box">
      <div className="captcha-heading">
        <span className="captcha-icon">
          <ShieldCheck size={19} />
        </span>
        <div>
          <strong>Security check</strong>
          <p>CAPTCHA is required after repeated posting attempts.</p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            className="icon-button captcha-refresh"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Get a new challenge"
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          </button>
        ) : null}
      </div>
      <div className="captcha-question-row">
        <label htmlFor="captcha-answer">{challenge.question}</label>
        <input
          id="captcha-answer"
          value={answer}
          onChange={(event) => onAnswerChange(event.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Answer"
        />
      </div>
    </div>
  );
}
