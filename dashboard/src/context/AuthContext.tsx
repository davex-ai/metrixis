import { createContext, useContext, useState, type ReactNode } from "react";
import { authApi } from "../lib/api";

interface AuthContextValue {
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<string>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(authApi.isLoggedIn());

  const login = async (email: string, password: string) => {
    await authApi.login(email, password);
    setIsLoggedIn(true);
  };

  const signup = async (email: string, password: string) => {
    const res = await authApi.signup(email, password);
    return res.message;
  };

  const logout = () => {
    authApi.logout();
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
