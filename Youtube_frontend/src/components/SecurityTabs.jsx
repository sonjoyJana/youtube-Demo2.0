import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/security', label: 'Overview', end: true },
  { to: '/history', label: 'Login history' },
  { to: '/devices', label: 'Trusted devices' },
  { to: '/sessions', label: 'Active sessions' },
  { to: '/appearance', label: 'Appearance' }
];

export function SecurityTabs() {
  return (
    <nav className="subnav" aria-label="Security sections">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `subnav-link ${isActive ? 'active' : ''}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
