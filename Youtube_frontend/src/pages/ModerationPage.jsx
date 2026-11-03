import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Filter,
  Flag,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import api, { getErrorMessage } from '../lib/api.js';
import { formatDateTime, timeAgo } from '../lib/format.js';
import { REPORT_REASONS } from '../lib/reportReasons.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from '../components/Avatar.jsx';
import Modal from '../components/Modal.jsx';

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((reason) => [reason.value, reason.label]));

const ACTION_LABEL = {
  comment_created: 'Comment posted',
  comment_edited: 'Comment edited',
  comment_deleted: 'Comment deleted',
  comment_removed: 'Comment removed',
  report_created: 'Report filed',
  report_dismissed: 'Report dismissed',
  report_resolved: 'Report resolved',
  blocked_attempt: 'Blocked attempt',
  captcha_required: 'CAPTCHA required',
  warning_issued: 'Warning issued',
};

export default function ModerationPage() {
  const { user, loading, isAdmin } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('reports');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [reports, setReports] = useState([]);
  const [reportPage, setReportPage] = useState(1);
  const [reportPages, setReportPages] = useState(1);
  const [logs, setLogs] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logPages, setLogPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState({});
  const [busyReport, setBusyReport] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.get('/moderation/stats');
      setStats(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }, []);

  const loadReports = useCallback(async () => {
    setLoadingData(true);
    setError('');
    try {
      const response = await api.get('/moderation/reports', {
        params: { status: statusFilter, page: reportPage, limit: 10 },
      });
      setReports(response.data.reports);
      setReportPages(response.data.pages);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingData(false);
    }
  }, [statusFilter, reportPage]);

  const loadLogs = useCallback(async () => {
    setLoadingData(true);
    setError('');
    try {
      const response = await api.get('/moderation/logs', {
        params: { page: logPage, limit: 20 },
      });
      setLogs(response.data.logs);
      setLogPages(response.data.pages);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingData(false);
    }
  }, [logPage]);

  useEffect(() => {
    if (!isAdmin) return;
    loadStats();
  }, [isAdmin, loadStats]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'reports') loadReports();
    else loadLogs();
  }, [isAdmin, tab, loadReports, loadLogs]);

  if (loading) {
    return (
      <div className="page-loading">
        <Loader2 size={24} className="spin" />
        Checking permissions…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="access-denied">
        <ShieldAlert size={38} />
        <h1>Sign in required</h1>
        <p>Sign in with an administrator account to open the moderation center.</p>
        <Link to="/login" className="primary-button">
          Sign in
        </Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="access-denied">
        <Ban size={38} />
        <h1>Administrator access required</h1>
        <p>
          You are signed in as @{user.username}. Use the demo moderator account
          (admin@example.com / admin123) to review reports.
        </p>
        <Link to="/watch" className="primary-button">
          Back to comments
        </Link>
      </div>
    );
  }

  async function resolveReport(report, action) {
    setBusyReport(report.id);
    try {
      await api.patch(`/moderation/reports/${report.id}`, {
        action,
        note: notes[report.id] || '',
      });
      toast.success(action === 'remove' ? 'Comment removed and reports resolved.' : 'Report dismissed.');
      setConfirmAction(null);
      await Promise.all([loadReports(), loadStats()]);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
    } finally {
      setBusyReport('');
    }
  }

  function refreshCurrent() {
    if (tab === 'reports') loadReports();
    else loadLogs();
    loadStats();
  }

  const statCards = [
    {
      label: 'Pending reports',
      value: stats?.pendingReports ?? '—',
      icon: Flag,
      tone: 'amber',
    },
    {
      label: 'Flagged comments',
      value: stats?.flaggedComments ?? '—',
      icon: ShieldAlert,
      tone: 'rose',
    },
    {
      label: 'Removed comments',
      value: stats?.removedComments ?? '—',
      icon: Trash2,
      tone: 'red',
    },
    {
      label: 'Blocked attempts',
      value: stats?.blockedAttempts ?? '—',
      icon: Ban,
      tone: 'violet',
    },
    {
      label: 'Visible comments',
      value: stats?.totalComments ?? '—',
      icon: Users,
      tone: 'green',
    },
  ];

  return (
    <main className="moderation-page">
      <div className="moderation-top">
        <div>
          <Link to="/watch" className="back-link">
            <ArrowLeft size={16} />
            Back to video
          </Link>
          <h1>Moderation Center</h1>
          <p>
            Review reported comments, inspect the full audit trail, and keep the community safe.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={refreshCurrent}>
          <RefreshCw size={16} className={loadingData ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="stat-grid">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className={`stat-card stat-${card.tone}`} key={card.label}>
              <span className="stat-icon">
                <Icon size={19} />
              </span>
              <div>
                <strong>{card.value}</strong>
                <span>{card.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="moderation-tabs">
        <button
          type="button"
          className={tab === 'reports' ? 'active' : ''}
          onClick={() => {
            setTab('reports');
            setReportPage(1);
          }}
        >
          <Flag size={17} />
          Reports
          {stats?.pendingReports ? <span className="tab-badge">{stats.pendingReports}</span> : null}
        </button>
        <button
          type="button"
          className={tab === 'logs' ? 'active' : ''}
          onClick={() => {
            setTab('logs');
            setLogPage(1);
          }}
        >
          <ClipboardList size={17} />
          Audit log
        </button>
      </div>

      {error ? (
        <div className="moderation-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" className="text-button" onClick={refreshCurrent}>
            Try again
          </button>
        </div>
      ) : null}

      {tab === 'reports' ? (
        <section className="moderation-panel">
          <div className="moderation-panel-head">
            <div>
              <h2>Report queue</h2>
              <p>Comments stay visible while reports are reviewed. Dislikes never delete a comment.</p>
            </div>
            <label className="filter-control">
              <Filter size={15} />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setReportPage(1);
                }}
              >
                <option value="pending">Pending</option>
                <option value="dismissed">Dismissed</option>
                <option value="removed">Removed</option>
                <option value="all">All reports</option>
              </select>
            </label>
          </div>

          {loadingData ? (
            <div className="page-loading compact">
              <Loader2 size={22} className="spin" />
              Loading reports…
            </div>
          ) : reports.length === 0 ? (
            <div className="moderation-empty">
              <CheckCircle2 size={30} />
              <h3>No reports in this view</h3>
              <p>The queue is clear for this filter.</p>
            </div>
          ) : (
            <div className="report-queue">
              {reports.map((report) => (
                <article className="report-card" key={report.id}>
                  <div className="report-card-head">
                    <div className="report-reason">
                      <span className={`reason-badge reason-${report.reason}`}>
                        {REASON_LABEL[report.reason] || report.reason}
                      </span>
                      <span className={`status-badge status-${report.status}`}>{report.status}</span>
                    </div>
                    <span className="report-date" title={formatDateTime(report.createdAt)}>
                      {timeAgo(report.createdAt)}
                    </span>
                  </div>

                  <div className="report-comment">
                    <div className="report-author">
                      <Avatar
                        name={report.snapshot?.authorUsername || 'Unknown'}
                        size={28}
                      />
                      <strong>@{report.snapshot?.authorUsername || 'unknown'}</strong>
                      <span className="language-pill">{report.snapshot?.language?.toUpperCase()}</span>
                    </div>
                    <p>{report.snapshot?.content || 'Comment content unavailable.'}</p>
                  </div>

                  {report.details ? (
                    <p className="report-details">
                      <strong>Reporter note:</strong> {report.details}
                    </p>
                  ) : null}

                  <div className="report-meta-row">
                    <span>
                      Reported by{' '}
                      <strong>@{report.reporter?.username || 'unknown'}</strong>
                    </span>
                    {report.snapshot?.videoId ? (
                      <Link
                        to={`/watch?video=${report.snapshot.videoId}#comments`}
                        className="inline-link"
                      >
                        Open video <ExternalLink size={13} />
                      </Link>
                    ) : null}
                  </div>

                  {report.status === 'pending' ? (
                    <>
                      <label className="field-label report-note-field">
                        Moderator note <span>(optional)</span>
                        <textarea
                          rows={2}
                          value={notes[report.id] || ''}
                          onChange={(event) =>
                            setNotes((current) => ({ ...current, [report.id]: event.target.value }))
                          }
                          placeholder="Explain the decision for the audit log."
                          maxLength={1000}
                        />
                      </label>
                      <div className="report-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={busyReport === report.id}
                          onClick={() => setConfirmAction({ report, action: 'dismiss' })}
                        >
                          <ShieldCheck size={16} />
                          Dismiss report
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          disabled={busyReport === report.id}
                          onClick={() => setConfirmAction({ report, action: 'remove' })}
                        >
                          {busyReport === report.id ? (
                            <Loader2 size={16} className="spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                          Remove comment
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="resolved-note">
                      <CheckCircle2 size={15} />
                      <span>
                        {report.status === 'removed' ? 'Comment removed' : 'Report dismissed'}
                        {report.moderator ? ` by @${report.moderator.username}` : ''}
                        {report.moderationNote ? ` — ${report.moderationNote}` : ''}
                      </span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {reportPages > 1 ? (
            <div className="pagination">
              <button
                type="button"
                className="secondary-button"
                disabled={reportPage <= 1 || loadingData}
                onClick={() => setReportPage((page) => page - 1)}
              >
                Previous
              </button>
              <span>
                Page {reportPage} of {reportPages}
              </span>
              <button
                type="button"
                className="secondary-button"
                disabled={reportPage >= reportPages || loadingData}
                onClick={() => setReportPage((page) => page + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="moderation-panel">
          <div className="moderation-panel-head">
            <div>
              <h2>Audit trail</h2>
              <p>Every comment edit, deletion, report, and moderation action is recorded.</p>
            </div>
          </div>

          {loadingData ? (
            <div className="page-loading compact">
              <Loader2 size={22} className="spin" />
              Loading audit log…
            </div>
          ) : logs.length === 0 ? (
            <div className="moderation-empty">
              <ClipboardList size={30} />
              <h3>No audit entries</h3>
            </div>
          ) : (
            <div className="audit-list">
              {logs.map((log) => (
                <article className="audit-entry" key={log.id}>
                  <span className={`audit-dot audit-${log.action}`} />
                  <div className="audit-main">
                    <div className="audit-head">
                      <strong>{ACTION_LABEL[log.action] || log.action}</strong>
                      <span title={formatDateTime(log.createdAt)}>{timeAgo(log.createdAt)}</span>
                    </div>
                    <p>
                      {log.actor ? `@${log.actor.username}` : 'System'}
                      {log.targetUser ? ` → @${log.targetUser.username}` : ''}
                      {log.note ? ` · ${log.note}` : ''}
                    </p>
                    <div className="audit-meta">
                      {log.comment?.language ? (
                        <span className="language-pill">{log.comment.language.toUpperCase()}</span>
                      ) : null}
                      {log.report?.reason ? (
                        <span className="audit-reason">Report: {REASON_LABEL[log.report.reason]}</span>
                      ) : null}
                      {log.metadata?.code ? (
                        <span className="audit-code">{log.metadata.code}</span>
                      ) : null}
                      <span className="audit-time">{formatDateTime(log.createdAt)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {logPages > 1 ? (
            <div className="pagination">
              <button
                type="button"
                className="secondary-button"
                disabled={logPage <= 1 || loadingData}
                onClick={() => setLogPage((page) => page - 1)}
              >
                Previous
              </button>
              <span>
                Page {logPage} of {logPages}
              </span>
              <button
                type="button"
                className="secondary-button"
                disabled={logPage >= logPages || loadingData}
                onClick={() => setLogPage((page) => page + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      )}

      {confirmAction ? (
        <Modal
          title={confirmAction.action === 'remove' ? 'Remove this comment?' : 'Dismiss this report?'}
          subtitle={
            confirmAction.action === 'remove'
              ? 'The comment will be hidden and all pending reports for it will be resolved.'
              : 'The comment will remain visible and the report will be closed.'
          }
          onClose={() => setConfirmAction(null)}
          footer={
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmAction(null)}
                disabled={Boolean(busyReport)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={confirmAction.action === 'remove' ? 'danger-button' : 'primary-button'}
                onClick={() => resolveReport(confirmAction.report, confirmAction.action)}
                disabled={Boolean(busyReport)}
              >
                {busyReport ? <Loader2 size={16} className="spin" /> : null}
                {confirmAction.action === 'remove' ? 'Remove comment' : 'Dismiss report'}
              </button>
            </>
          }
        >
          <div className="delete-preview">
            <p>{confirmAction.report.snapshot?.content || 'Comment content unavailable.'}</p>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
