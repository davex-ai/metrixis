import { NavLink } from 'react-router-dom';

export default function Sidebar({ sites }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">metrixis</div>

      <div className="sidebar-section-label">Sites</div>
      <nav className="sidebar-sites">
        {sites.length === 0 && <p className="sidebar-empty">No sites yet</p>}
        {sites.map((site) => (
          <NavLink
            key={site.id}
            to={`/sites/${site.id}`}
            className={({ isActive }) => 'sidebar-site' + (isActive ? ' active' : '')}
          >
            <span className="sidebar-site-dot" />
            {site.name}
          </NavLink>
        ))}
      </nav>

      <NavLink to="/sites/new" className="sidebar-add">
        + Add site
      </NavLink>
    </aside>
  );
}
