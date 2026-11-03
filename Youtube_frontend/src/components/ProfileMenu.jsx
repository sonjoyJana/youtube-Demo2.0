import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe2, LogOut, PhoneCall, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { LANGUAGES } from '../lib/languages.js';
import api, { getErrorMessage } from '../lib/api.js';
import Avatar from './Avatar.jsx';

export default function ProfileMenu({ onClose }) {
  const { user, logout, updateUser, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [savingLanguage, setSavingLanguage] = useState(false);

  async function changeLanguage(event) {
    const preferredLanguage = event.target.value;
    setSavingLanguage(true);
    try {
      const response = await api.patch('/users/me', { preferredLanguage });
      updateUser(response.data.user);
      toast.success('Preferred language updated.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingLanguage(false);
    }
  }

  function handleLogout() {
    logout();
    onClose();
    navigate('/watch');
    toast.info('You have been signed out.');
  }

  if (!user) return null;

  return (
    <div className="dropdown-panel profile-panel">
      <div className="profile-card">
        <Avatar name={user.username} src={user.avatar} size={46} />
        <div>
          <strong>{user.username}</strong>
          <span>{user.email}</span>
          <small>{user.location}</small>
        </div>
      </div>

      <div className="profile-language">
        <label htmlFor="profile-language-select">
          <Globe2 size={16} />
          Translation language
        </label>
        <select
          id="profile-language-select"
          value={user.preferredLanguage}
          onChange={changeLanguage}
          disabled={savingLanguage}
        >
          {LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.name} — {language.native}
            </option>
          ))}
        </select>
      </div>

      <div className="profile-menu-links">
        <Link to="/watch" onClick={onClose}>
          <UserRound size={17} />
          Watch & comment
        </Link>
        <Link to="/call" onClick={onClose}>
          <PhoneCall size={17} />
          Video call
        </Link>
        {isAdmin ? (
          <Link to="/moderation" onClick={onClose}>
            <ShieldCheck size={17} />
            Moderation center
          </Link>
        ) : null}
        <button type="button" onClick={handleLogout}>
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    </div>
  );
}
