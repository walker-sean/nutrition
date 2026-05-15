import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Today', icon: '📋', end: true },
  { to: '/library', label: 'Library', icon: '🥦', end: false },
  { to: '/progress', label: 'Progress', icon: '📈', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false },
];

export default function TabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border grid grid-cols-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
      {tabs.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-xs ${isActive ? 'text-accent font-semibold' : 'text-muted'}`
          }
        >
          <span className="text-lg">{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
