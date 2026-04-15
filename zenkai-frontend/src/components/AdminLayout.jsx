import { useState } from 'react';
import './AdminLayout.css';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clients',   label: 'Clients' },
  { id: 'programs',  label: 'Programs' },
  { id: 'exerciseLibrary', label: 'Exercise Library', parked: true },
];

export default function AdminLayout({ activeSection, onSectionChange, children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="admin-shell">
      <nav className={`admin-nav${collapsed ? ' admin-nav--collapsed' : ''}`}>
        <button
          className="admin-nav__toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand nav' : 'Collapse nav'}
        >
          {collapsed ? '›' : '‹'}
        </button>
        {!collapsed && (
          <>
            <div className="admin-nav__brand">ZENKAI</div>
            <div className="admin-nav__role">Admin</div>
          </>
        )}
        <ul className="admin-nav__list">
          {NAV_ITEMS.map(item => (
            <li key={item.id}>
              <button
                className={[
                  'admin-nav__item',
                  activeSection === item.id ? 'admin-nav__item--active' : '',
                  item.parked ? 'admin-nav__item--parked' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => onSectionChange(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <span className="admin-nav__item-dot" />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.parked && <span className="admin-nav__badge">Soon</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="admin-content">
        {children}
      </main>
    </div>
  );
}
