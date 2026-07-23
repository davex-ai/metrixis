import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { api } from '../api/client';

export default function DashboardShell({ children }) {
  const [sites, setSites] = useState([]);
  const [loaded, setLoaded] = useState(false);

  async function refreshSites() {
    const data = await api.listSites();
    setSites(data.sites);
  }

  useEffect(() => {
    refreshSites().finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <div className="empty-state full-page">Loading…</div>;
  }

  return (
    <div className="dashboard-shell">
      <Sidebar sites={sites} />
      <main className="dashboard-main">
        {typeof children === 'function' ? children({ sites, refreshSites }) : children}
      </main>
    </div>
  );
}
