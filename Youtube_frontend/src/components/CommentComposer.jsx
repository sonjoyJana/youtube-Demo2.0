import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe2, Loader2, Send } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api.js';
import { LANGUAGES } from '../lib/languages.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from './Avatar.jsx';
import CaptchaBox from './CaptchaBox.jsx';

export default function CommentComposer({
  videoId,
  parentId = null,
  onPosted,
  onCancel,
  compact = false,
  placeholder = 'Add a comment…',
}) {
  const { user } = useAuth();
  const toast = useToast();
  const textareaRef = useRef(null);
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState(user?.preferredLanguage || 'en');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [refreshingCaptcha, setRefreshingCaptcha] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);

  useEffect(() => {
    if (user?.preferredLanguage) setLanguage(user.preferredLanguage);
  }, [user?.preferredLanguage]);

  useEffect(() => {
    if (mentionQuery === null || mentionQuery.length < 1) {
      setMentionResults([]);
      setMentionLoading(false);
      return undefined;
    }

    let active = true;
    setMentionLoading(true);
    const timer = window.setTimeout(() => {
      api
        .get('/users/search', { params: { q: mentionQuery } })
        .then((response) => {
          if (active) setMentionResults(response.data.users);
        })
        .catch(() => {
          if (active) setMentionResults([]);
        })
        .finally(() => {
          if (active) setMentionLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [mentionQuery]);

  if (!user) {
    return (
      <div className="sign-in-comment-prompt">
        <p>Sign in to join the conversation, translate comments, and follow replies.</p>
        <Link to="/login" className="sign-in-button">
          Sign in
        </Link>
      </div>
    );
  }

  function handleContentChange(event) {
    const value = event.target.value;
    setContent(value);
    setError('');

    const caret = event.target.selectionStart || 0;
    const beforeCaret = value.slice(0, caret);
    const match = beforeCaret.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setShowMentionMenu(true);
    } else {
      setMentionQuery(null);
      setShowMentionMenu(false);
    }
  }

  function insertMention(username) {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? content.length;
    const beforeCaret = content.slice(0, caret);
    const match = beforeCaret.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    if (!match) return;

    const atIndex = beforeCaret.lastIndexOf('@');
    const nextContent = `${content.slice(0, atIndex)}@${username} ${content.slice(caret)}`;
    setContent(nextContent);
    setMentionQuery(null);
    setShowMentionMenu(false);
    setMentionResults([]);

    window.requestAnimationFrame(() => {
      const nextCaret = atIndex + username.length + 2;
      textarea?.focus();
      textarea?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  async function refreshCaptcha() {
    setRefreshingCaptcha(true);
    try {
      const response = await api.get('/comments/captcha');
      setChallenge(response.data.challenge);
      setCaptchaAnswer('');
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
    } finally {
      setRefreshingCaptcha(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const payload = {
        videoId,
        content,
        language,
        ...(parentId ? { parentId } : {}),
        ...(challenge
          ? { captchaToken: challenge.token, captchaAnswer: captchaAnswer.trim() }
          : {}),
      };
      const response = await api.post('/comments', payload);
      setContent('');
      setChallenge(null);
      setCaptchaAnswer('');
      setMentionQuery(null);
      setShowMentionMenu(false);
      toast.success(parentId ? 'Reply posted.' : 'Comment posted.');
      onPosted?.(response.data.comment);
    } catch (requestError) {
      const data = requestError?.response?.data;
      if (data?.captchaRequired) {
        if (data.challenge) setChallenge(data.challenge);
        setError('Complete the security check below, then post again.');
      } else {
        setError(getErrorMessage(requestError));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`comment-composer ${compact ? 'compact' : ''}`}>
      <Avatar name={user.username} src={user.avatar} size={compact ? 32 : 40} />
      <form onSubmit={handleSubmit} className="composer-form">
        <div className="composer-input-wrap">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setShowMentionMenu(false);
            }}
            placeholder={placeholder}
            rows={compact ? 2 : 3}
            maxLength={2000}
            disabled={submitting}
          />

          {showMentionMenu && mentionQuery !== null ? (
            <div className="mention-menu">
              {mentionLoading ? (
                <div className="mention-state">
                  <Loader2 size={15} className="spin" />
                  Searching…
                </div>
              ) : mentionQuery.length === 0 ? (
                <div className="mention-state">Type a username to mention someone</div>
              ) : mentionResults.length === 0 ? (
                <div className="mention-state">No users found for @{mentionQuery}</div>
              ) : (
                mentionResults.map((result) => (
                  <button
                    type="button"
                    key={result.id}
                    className="mention-option"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertMention(result.username)}
                  >
                    <Avatar name={result.username} src={result.avatar} size={28} />
                    <span>
                      <strong>@{result.username}</strong>
                      <small>{result.location}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="composer-toolbar">
          <label className="composer-language">
            <Globe2 size={15} />
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              aria-label="Comment language"
              disabled={submitting}
            >
              {LANGUAGES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <div className="composer-buttons">
            {content.length > 1800 ? (
              <span className={`char-counter ${content.length >= 2000 ? 'limit' : ''}`}>
                {content.length}/2000
              </span>
            ) : null}
            {onCancel ? (
              <button type="button" className="text-button" onClick={onCancel} disabled={submitting}>
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              className="comment-submit-button"
              disabled={submitting || !content.trim()}
            >
              {submitting ? <Loader2 size={17} className="spin" /> : <Send size={16} />}
              {compact ? 'Reply' : 'Comment'}
            </button>
          </div>
        </div>

        {challenge ? (
          <CaptchaBox
            challenge={challenge}
            answer={captchaAnswer}
            onAnswerChange={setCaptchaAnswer}
            onRefresh={refreshCaptcha}
            refreshing={refreshingCaptcha}
          />
        ) : null}

        {error ? <div className="form-error">{error}</div> : null}
        {!compact ? (
          <p className="composer-hint">
            Be kind. Profanity, spam, duplicate comments, and malicious links are blocked
            automatically.
          </p>
        ) : null}
      </form>
    </div>
  );
}
