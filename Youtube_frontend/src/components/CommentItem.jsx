import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Flag,
  History,
  Languages,
  Loader2,
  MapPin,
  MessageSquare,
  Pencil,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import api, { getErrorMessage } from '../lib/api.js';
import { formatCount, formatDateTime, timeAgo } from '../lib/format.js';
import { LANGUAGES, languageLabel, languageName } from '../lib/languages.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from './Avatar.jsx';
import CommentComposer from './CommentComposer.jsx';
import Modal from './Modal.jsx';
import ReportModal from './ReportModal.jsx';

function renderMentions(text) {
  const parts = String(text).split(/(@[a-zA-Z0-9_]{3,30})/g);
  return parts.map((part, index) =>
    /^@[a-zA-Z0-9_]{3,30}$/.test(part) ? (
      <span className="mention" key={`${part}-${index}`}>
        {part}
      </span>
    ) : (
      <Fragment key={`text-${index}`}>{part}</Fragment>
    )
  );
}

export default function CommentItem({ comment, onPatch, onRefresh, depth = 0 }) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const translateRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [editLanguage, setEditLanguage] = useState(comment.language);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [reactionBusy, setReactionBusy] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [translateTarget, setTranslateTarget] = useState(user?.preferredLanguage || 'en');
  const [showTranslateMenu, setShowTranslateMenu] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState(null);
  const [translateError, setTranslateError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyEntries, setHistoryEntries] = useState([]);

  useEffect(() => {
    if (user?.preferredLanguage) setTranslateTarget(user.preferredLanguage);
  }, [user?.preferredLanguage]);

  useEffect(() => {
    if (!showTranslateMenu) return undefined;
    function handleOutside(event) {
      if (translateRef.current && !translateRef.current.contains(event.target)) {
        setShowTranslateMenu(false);
      }
    }
    function handleEscape(event) {
      if (event.key === 'Escape') setShowTranslateMenu(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showTranslateMenu]);

  function requireAuth(message) {
    if (user) return true;
    toast.info(message);
    navigate('/login');
    return false;
  }

  async function handleReaction(type) {
    if (!requireAuth('Sign in to react to comments.')) return;
    const nextReaction = comment.myReaction === type ? 'none' : type;
    setReactionBusy(true);
    try {
      const response = await api.post(`/comments/${comment.id}/react`, {
        reaction: nextReaction,
      });
      onPatch(comment.id, response.data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setReactionBusy(false);
    }
  }

  function startEditing() {
    setEditContent(comment.content);
    setEditLanguage(comment.language);
    setEditError('');
    setTranslation(null);
    setTranslateError('');
    setEditing(true);
  }

  async function saveEdit() {
    if (!editContent.trim() || savingEdit) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const response = await api.patch(`/comments/${comment.id}`, {
        content: editContent,
        language: editLanguage,
        version: comment.version,
      });
      onPatch(comment.id, response.data.comment);
      setTranslation(null);
      setEditing(false);
      toast.success('Comment updated.');
    } catch (error) {
      const data = error?.response?.data;
      if (data?.code === 'EDIT_CONFLICT' && data.comment) {
        onPatch(comment.id, data.comment);
        setEditError(
          'This comment was edited somewhere else. The latest version is loaded — review your draft and save again.'
        );
      } else {
        setEditError(getErrorMessage(error));
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/comments/${comment.id}`);
      setDeleteOpen(false);
      toast.success(comment.replies?.length ? 'Comment deleted. Replies remain visible.' : 'Comment deleted.');
      onRefresh();
    } catch (error) {
      setDeleteError(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  async function translateTo(target) {
    if (!comment.content) return;
    setShowTranslateMenu(false);
    if (target === comment.language) {
      setTranslation(null);
      setTranslateError('');
      toast.info(`This comment is already in ${languageName(comment.language)}.`);
      return;
    }
    setTranslating(true);
    setTranslateError('');
    try {
      const response = await api.post('/translate', {
        text: comment.content,
        source: comment.language,
        target,
      });
      setTranslation({ ...response.data, target, showOriginal: false });
      setTranslateTarget(target);
    } catch (error) {
      const message = getErrorMessage(error, 'Translation failed. Please try again.');
      setTranslateError(message);
      toast.error(message);
    } finally {
      setTranslating(false);
    }
  }

  async function openHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await api.get(`/comments/${comment.id}/history`);
      setHistoryEntries(response.data.history);
    } catch (error) {
      setHistoryError(getErrorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  }

  const preferredLanguage = user?.preferredLanguage || 'en';
  const sortedLanguages = [...LANGUAGES].sort((first, second) => {
    if (first.code === preferredLanguage) return -1;
    if (second.code === preferredLanguage) return 1;
    if (first.code === 'en') return -1;
    if (second.code === 'en') return 1;
    return first.name.localeCompare(second.name);
  });

  const isReply = depth > 0;
  const showTranslation = translation && !translation.showOriginal;
  const historyAllowed = isAdmin || (comment.isOwner && (comment.edited || comment.isDeleted));

  return (
    <article className={`comment ${isReply ? 'comment-reply' : ''} ${comment.isDeleted ? 'comment-deleted' : ''}`}>
      <Avatar
        name={comment.author.username}
        src={comment.author.avatar}
        size={isReply ? 32 : 40}
      />
      <div className="comment-main">
        <div className="comment-head">
          <div className="comment-author-line">
            <strong className="comment-author">{comment.author.username}</strong>
            {comment.author.location ? (
              <span className="comment-location" title={comment.author.location}>
                <MapPin size={12} />
                {comment.author.location}
              </span>
            ) : null}
            <span className="comment-time" title={formatDateTime(comment.createdAt)}>
              {timeAgo(comment.createdAt)}
            </span>
            <span className="comment-full-date">{formatDateTime(comment.createdAt)}</span>
            {comment.edited ? (
              historyAllowed ? (
                <button
                  type="button"
                  className="edited-badge edited-badge-button"
                  onClick={openHistory}
                  title={`Edited ${formatDateTime(comment.editedAt)}`}
                >
                  Edited
                </button>
              ) : (
                <span className="edited-badge" title={`Edited ${formatDateTime(comment.editedAt)}`}>
                  Edited
                </span>
              )
            ) : null}
            <span className="language-pill" title={languageLabel(comment.language)}>
              {languageName(comment.language)}
            </span>
            {comment.isFlagged ? (
              <span className="flagged-pill" title="Flagged for moderator review">
                <ShieldAlert size={12} />
                Flagged{comment.reportCount ? ` · ${comment.reportCount}` : ''}
              </span>
            ) : null}
          </div>
        </div>

        {editing ? (
          <div className="comment-editor">
            <textarea
              value={editContent}
              onChange={(event) => {
                setEditContent(event.target.value);
                setEditError('');
              }}
              rows={4}
              maxLength={2000}
              disabled={savingEdit}
            />
            <div className="comment-editor-footer">
              <label className="composer-language">
                <Languages size={14} />
                <select
                  value={editLanguage}
                  onChange={(event) => setEditLanguage(event.target.value)}
                  disabled={savingEdit}
                  aria-label="Comment language"
                >
                  {LANGUAGES.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.name}
                    </option>
                  ))}
                </select>
              </label>
              <span className="char-counter">{editContent.length}/2000</span>
              <button
                type="button"
                className="text-button"
                onClick={() => setEditing(false)}
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="comment-submit-button small"
                onClick={saveEdit}
                disabled={savingEdit || !editContent.trim()}
              >
                {savingEdit ? <Loader2 size={15} className="spin" /> : null}
                Save changes
              </button>
            </div>
            {editError ? <div className="form-error">{editError}</div> : null}
          </div>
        ) : (
          <>
            {comment.isDeleted ? (
              <p className="deleted-tombstone">Comment deleted by its author.</p>
            ) : showTranslation ? (
              <div className="comment-content translated-content">
                <p>{renderMentions(translation.translated)}</p>
                <div className="translation-note">
                  <Languages size={13} />
                  Translated from {languageName(translation.source)} to{' '}
                  {languageName(translation.target)} ·{' '}
                  {translation.provider === 'local' ? 'offline dictionary' : translation.provider}
                  <button
                    type="button"
                    onClick={() => setTranslation((current) => ({ ...current, showOriginal: true }))}
                  >
                    Show original
                  </button>
                </div>
              </div>
            ) : (
              <div className="comment-content">
                <p>{renderMentions(comment.content)}</p>
                {translation ? (
                  <div className="translation-note">
                    <Languages size={13} />
                    Showing original
                    <button
                      type="button"
                      onClick={() =>
                        setTranslation((current) => ({ ...current, showOriginal: false }))
                      }
                    >
                      Show translation
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}

        {translateError ? <div className="inline-warning">{translateError}</div> : null}

        {comment.isDeleted && historyAllowed ? (
          <div className="comment-actions">
            <button type="button" className="comment-action" onClick={openHistory}>
              <History size={15} />
              History
            </button>
          </div>
        ) : null}

        {!comment.isDeleted && !editing ? (
          <div className="comment-actions">
            <button
              type="button"
              className={`comment-action ${comment.myReaction === 'like' ? 'active' : ''}`}
              onClick={() => handleReaction('like')}
              disabled={reactionBusy}
              aria-pressed={comment.myReaction === 'like'}
              title="Like"
            >
              <ThumbsUp size={16} fill={comment.myReaction === 'like' ? 'currentColor' : 'none'} />
              {comment.likes > 0 ? formatCount(comment.likes) : ''}
            </button>
            <button
              type="button"
              className={`comment-action ${comment.myReaction === 'dislike' ? 'active' : ''}`}
              onClick={() => handleReaction('dislike')}
              disabled={reactionBusy}
              aria-pressed={comment.myReaction === 'dislike'}
              title="Dislike"
            >
              <ThumbsDown
                size={16}
                fill={comment.myReaction === 'dislike' ? 'currentColor' : 'none'}
              />
              {comment.dislikes > 0 ? formatCount(comment.dislikes) : ''}
            </button>

            {!isReply ? (
              <button
                type="button"
                className="comment-action"
                onClick={() => {
                  if (!requireAuth('Sign in to reply to comments.')) return;
                  setReplyOpen((current) => !current);
                }}
              >
                <MessageSquare size={16} />
                Reply
              </button>
            ) : null}

            <div className="translate-action" ref={translateRef}>
              <button
                type="button"
                className="comment-action"
                onClick={() => translateTo(translateTarget)}
                disabled={translating}
                title={`Translate to ${languageName(translateTarget)}`}
              >
                {translating ? <Loader2 size={16} className="spin" /> : <Languages size={16} />}
                {translating ? 'Translating…' : 'Translate'}
              </button>
              <button
                type="button"
                className="translate-caret"
                onClick={() => setShowTranslateMenu((current) => !current)}
                aria-label="Choose translation language"
                aria-expanded={showTranslateMenu}
              >
                <ChevronDown size={14} />
              </button>

              {showTranslateMenu ? (
                <div className="translate-menu">
                  <div className="translate-menu-header">
                    <strong>Translate to</strong>
                    <span>Your language: {languageName(preferredLanguage)}</span>
                  </div>
                  <div className="translate-menu-list">
                    {sortedLanguages.map((language) => (
                      <button
                        type="button"
                        key={language.code}
                        className={language.code === translateTarget ? 'selected' : ''}
                        onClick={() => translateTo(language.code)}
                      >
                        <span>{language.name}</span>
                        <small>{language.native}</small>
                        {language.code === preferredLanguage ? (
                          <em>Preferred</em>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {comment.canEdit ? (
              <button type="button" className="comment-action" onClick={startEditing}>
                <Pencil size={15} />
                Edit
              </button>
            ) : null}

            {comment.canDelete ? (
              <button
                type="button"
                className="comment-action danger-action"
                onClick={() => {
                  setDeleteError('');
                  setDeleteOpen(true);
                }}
              >
                <Trash2 size={15} />
                Delete
              </button>
            ) : null}

            {!comment.isOwner ? (
              <button
                type="button"
                className="comment-action"
                onClick={() => {
                  if (!requireAuth('Sign in to report comments.')) return;
                  setReportOpen(true);
                }}
              >
                <Flag size={15} />
                Report
              </button>
            ) : null}

            {historyAllowed ? (
              <button type="button" className="comment-action" onClick={openHistory}>
                <History size={15} />
                History
              </button>
            ) : null}
          </div>
        ) : null}

        {replyOpen && !comment.isDeleted ? (
          <div className="reply-composer-wrap">
            <CommentComposer
              videoId={comment.videoId}
              parentId={comment.id}
              compact
              placeholder={`Reply to @${comment.author.username}…`}
              onCancel={() => setReplyOpen(false)}
              onPosted={() => {
                setReplyOpen(false);
                onRefresh();
              }}
            />
          </div>
        ) : null}

        {comment.replies?.length > 0 ? (
          <div className="reply-list">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                onPatch={onPatch}
                onRefresh={onRefresh}
                depth={depth + 1}
              />
            ))}
          </div>
        ) : null}
      </div>

      {reportOpen ? (
        <ReportModal
          comment={comment}
          onClose={() => setReportOpen(false)}
          onReported={() => setReportOpen(false)}
        />
      ) : null}

      {deleteOpen ? (
        <Modal
          title="Delete this comment?"
          subtitle={
            comment.replies?.length
              ? 'Replies from other users will remain visible so the conversation stays intact.'
              : 'This action cannot be undone.'
          }
          onClose={() => setDeleteOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                Delete comment
              </button>
            </>
          }
        >
          <div className="delete-preview">
            <p>{comment.content}</p>
          </div>
          {deleteError ? <div className="form-error">{deleteError}</div> : null}
        </Modal>
      ) : null}

      {historyOpen ? (
        <Modal
          title="Comment history"
          subtitle="Every edit and deletion is recorded for accountability."
          size="large"
          onClose={() => setHistoryOpen(false)}
          footer={
            <button type="button" className="secondary-button" onClick={() => setHistoryOpen(false)}>
              Close
            </button>
          }
        >
          {historyLoading ? (
            <div className="panel-state">
              <Loader2 size={20} className="spin" />
              Loading history…
            </div>
          ) : historyError ? (
            <div className="form-error">{historyError}</div>
          ) : historyEntries.length === 0 ? (
            <div className="panel-state">No history has been recorded for this comment.</div>
          ) : (
            <div className="history-list">
              {historyEntries.map((entry) => (
                <div className="history-entry" key={entry.id}>
                  <div className="history-entry-head">
                    <span className={`history-action history-${entry.action}`}>{entry.action}</span>
                    <span>{formatDateTime(entry.createdAt)}</span>
                    {entry.actor ? <span>by @{entry.actor.username}</span> : null}
                  </div>
                  {entry.previousContent ? (
                    <blockquote>{entry.previousContent}</blockquote>
                  ) : null}
                  {entry.reason ? <p className="history-reason">{entry.reason}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Modal>
      ) : null}
    </article>
  );
}
