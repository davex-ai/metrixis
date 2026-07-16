import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { SitesPage } from "./pages/SitesPage";
import { SiteDashboardPage } from "./pages/SiteDashboardPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
          <Route
            path="/sites"
            element={
              <ProtectedRoute>
                <SitesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sites/:siteId"
            element={
              <ProtectedRoute>
                <SiteDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/sites" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
