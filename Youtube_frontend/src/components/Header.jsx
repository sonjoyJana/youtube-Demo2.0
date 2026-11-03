import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Menu, Mic, PhoneCall, Search, Video } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api from '../lib/api.js';
import Logo from './Logo.jsx';
import Avatar from './Avatar.jsx';
import NotificationPanel from './NotificationPanel.jsx';
import ProfileMenu from './ProfileMenu.jsx';

export default function Header() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const rightSideRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    let active = true;
    api
      .get('/users/me/notifications', { params: { limit: 1 } })
      .then((response) => {
        if (active) setUnreadCount(response.data.unreadCount);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (rightSideRef.current && !rightSideRef.current.contains(event.target)) {
        setShowNotifications(false);
        setShowProfile(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearch(event) {
    event.preventDefault();
    if (!search.trim()) return;
    navigate(`/?search=${encodeURIComponent(search.trim())}`);
  }

  function handleCreate() {
    if (!user) {
      navigate('/login');
      return;
    }
    toast.info('Uploads are not part of this commenting demo.');
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <button type="button" className="icon-button menu-button" aria-label="Menu">
          <Menu size={22} />
        </button>
        <Logo />
      </div>

      <form className="header-search" onSubmit={handleSearch} role="search">
        <div className="search-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            aria-label="Search"
          />
          <button type="submit" className="search-submit" aria-label="Search">
            <Search size={19} />
          </button>
        </div>
        <button type="button" className="mic-button" aria-label="Voice search">
          <Mic size={18} />
        </button>
      </form>

      <div className="header-right" ref={rightSideRef}>
        <Link
          to={user ? '/call' : '/login'}
          className="icon-button call-button"
          aria-label="Video call"
          title="Video call"
        >
          <PhoneCall size={22} />
        </Link>
        <button type="button" className="icon-button create-button" onClick={handleCreate} aria-label="Create">
          <Video size={22} />
        </button>

        {loading ? (
          <span className="header-loading" />
        ) : user ? (
          <>
            <div className="header-popover-anchor">
              <button
                type="button"
                className="icon-button notification-button"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                onClick={() => {
                  setShowNotifications((current) => !current);
                  setShowProfile(false);
                }}
              >
                <Bell size={22} />
                {unreadCount > 0 ? (
                  <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                ) : null}
              </button>
              {showNotifications ? (
                <NotificationPanel
                  onClose={() => setShowNotifications(false)}
                  onUnreadChange={setUnreadCount}
                />
              ) : null}
            </div>

            <div className="header-popover-anchor">
              <button
                type="button"
                className="avatar-button"
                aria-label="Account menu"
                onClick={() => {
                  setShowProfile((current) => !current);
                  setShowNotifications(false);
                }}
              >
                <Avatar name={user.username} src={user.avatar} size={32} />
              </button>
              {showProfile ? <ProfileMenu onClose={() => setShowProfile(false)} /> : null}
            </div>
          </>
        ) : (
          <Link to="/login" className="sign-in-button">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
