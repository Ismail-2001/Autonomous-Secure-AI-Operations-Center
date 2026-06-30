"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  const login = useCallback((newToken: string) => {
    setToken(newToken);
    try { localStorage.setItem("asoc_token", newToken); } catch {}
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    try { localStorage.removeItem("asoc_token"); } catch {}
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("asoc_token");
      if (stored) {
        setToken(stored);
        return;
      }
    } catch {}

    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "dashboard-ui", role: "analyst", client_id: "web" }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => login(data.access_token))
      .catch(() => {
        login(process.env.NEXT_PUBLIC_WS_TOKEN || "my-SOC-agent-2001");
      });
  }, [login]);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
