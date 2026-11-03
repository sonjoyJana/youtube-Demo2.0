import { useState } from 'react';
import { CheckCircle2, Flag, Loader2, ShieldCheck } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api.js';
import { REPORT_REASONS } from '../lib/reportReasons.js';
import { useToast } from '../context/ToastContext.jsx';
import Modal from './Modal.jsx';

export default function ReportModal({ comment, onClose, onReported }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event) {
    event?.preventDefault();
    if (!reason) {
      setError('Choose a reason for reporting this comment.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/comments/${comment.id}/report`, { reason, details });
      setSubmitted(true);
      toast.success('Report submitted for moderator review.');
      onReported?.();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={submitted ? 'Report submitted' : 'Report comment'}
      subtitle={
        submitted
          ? 'Thank you for helping keep the community safe.'
          : 'Reports are reviewed by moderators. Dislikes alone never delete a comment.'
      }
      onClose={onClose}
      footer={
        submitted ? (
          <button type="button" className="primary-button" onClick={onClose}>
            Done
          </button>
        ) : (
          <>
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={handleSubmit}
              disabled={submitting || !reason}
            >
              {submitting ? <Loader2 size={17} className="spin" /> : <Flag size={17} />}
              Submit report
            </button>
          </>
        )
      }
    >
      {submitted ? (
        <div className="report-success">
          <span className="report-success-icon">
            <CheckCircle2 size={34} />
          </span>
          <p>
            A moderator will review this comment. The author will not be told who reported it.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="report-form">
          <div className="report-preview">
            <span className="report-preview-label">
              <ShieldCheck size={15} />
              Comment by @{comment.author.username}
            </span>
            <p>{comment.content}</p>
          </div>

          <fieldset className="reason-list">
            <legend>Select a reason</legend>
            {REPORT_REASONS.map((option) => (
              <label
                key={option.value}
                className={`reason-option ${reason === option.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                />
                <span className="reason-radio" />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="field-label" htmlFor="report-details">
            Additional details <span>(optional)</span>
          </label>
          <textarea
            id="report-details"
            value={details}
            onChange={(event) => setDetails(event.target.value.slice(0, 500))}
            rows={3}
            placeholder="Add context that will help the moderator review this report."
          />
          <div className="field-counter">{details.length}/500</div>

          {error ? <div className="form-error">{error}</div> : null}
        </form>
      )}
    </Modal>
  );
}
