import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ sites }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

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

      <div className="sidebar-footer">
        <span className="sidebar-user">{user?.email}</span>
        <button className="sidebar-logout" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </aside>
  );
}
