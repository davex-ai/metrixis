import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/RequireAuth';
import DashboardShell from './components/DashboardShell';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import AddSitePage from './pages/AddSitePage';
import SiteDashboardPage from './pages/SiteDashboardPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />

          <Route
            path="/*"
            element={
              <RequireAuth>
                <DashboardShell>
                  {({ sites, refreshSites }) => (
                    <Routes>
                      <Route path="/" element={<HomePage sites={sites} />} />
                      <Route
                        path="/sites/new"
                        element={<AddSitePage onSiteCreated={refreshSites} />}
                      />
                      <Route path="/sites/:siteId" element={<SiteDashboardPage sites={sites} />} />
                    </Routes>
                  )}
                </DashboardShell>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
