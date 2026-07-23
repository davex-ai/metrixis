import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DashboardShell from './components/DashboardShell';
import HomePage from './pages/HomePage';
import AddSitePage from './pages/AddSitePage';
import SiteDashboardPage from './pages/SiteDashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <DashboardShell>
        {({ sites, refreshSites }) => (
          <Routes>
            <Route path="/" element={<HomePage sites={sites} />} />
            <Route path="/sites/new" element={<AddSitePage onSiteCreated={refreshSites} />} />
            <Route path="/sites/:siteId" element={<SiteDashboardPage sites={sites} />} />
          </Routes>
        )}
      </DashboardShell>
    </BrowserRouter>
  );
}
