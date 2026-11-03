import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, ShieldCheck } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';
import Avatar from './Avatar.jsx';

export default function NotificationPanel({ onClose, onUnreadChange }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .get('/users/me/notifications')
      .then((response) => {
        if (!active) return;
        setNotifications(response.data.notifications);
        onUnreadChange(response.data.unreadCount);
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onUnreadChange]);

  async function markAllRead() {
    try {
      await api.patch('/users/me/notifications/read-all');
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      onUnreadChange(0);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function openNotification(notification) {
    if (!notification.read) {
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
      );
      onUnreadChange(
        Math.max(0, notifications.filter((item) => !item.read && item.id !== notification.id).length)
      );
      api.patch(`/users/me/notifications/${notification.id}/read`).catch(() => {});
    }
    onClose();
    navigate(notification.videoId ? `/watch?video=${notification.videoId}#comments` : '/watch');
  }

  return (
    <div className="dropdown-panel notifications-panel">
      <div className="dropdown-panel-header">
        <h3>Notifications</h3>
        <button type="button" className="text-button" onClick={markAllRead}>
          <CheckCheck size={16} />
          Mark all read
        </button>
      </div>

      <div className="notification-list">
        {loading ? (
          <div className="panel-state">
            <Loader2 className="spin" size={22} />
            Loading notifications…
          </div>
        ) : error ? (
          <div className="panel-state error-text">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="panel-state empty-state">
            <Bell size={26} />
            <span>No notifications yet.</span>
            <small>Mentions and replies will appear here.</small>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              type="button"
              key={notification.id}
              className={`notification-item ${notification.read ? '' : 'unread'}`}
              onClick={() => openNotification(notification)}
            >
              <div className="notification-avatar-wrap">
                {notification.type === 'moderation' ? (
                  <span className="notification-moderation-icon">
                    <ShieldCheck size={18} />
                  </span>
                ) : (
                  <Avatar
                    name={notification.actor?.username || 'System'}
                    src={notification.actor?.avatar}
                    size={36}
                  />
                )}
                {!notification.read ? <span className="unread-dot" /> : null}
              </div>
              <div className="notification-copy">
                <p>{notification.message}</p>
                <span>{timeAgo(notification.createdAt)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
