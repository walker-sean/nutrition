import { NavLink, Outlet } from 'react-router-dom';

const subTabs = [
  { to: '/library', label: 'Foods', end: true },
  { to: '/library/recipes', label: 'Recipes', end: false },
  { to: '/library/plans', label: 'Plans', end: false },
];

export default function LibraryLayout() {
  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold">Library</h1>
      <nav className="flex gap-1 bg-card rounded-lg p-1 text-sm" aria-label="Library sections">
        {subTabs.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 text-center rounded-md py-1 ${isActive ? 'bg-surface font-semibold text-white' : 'text-muted'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
