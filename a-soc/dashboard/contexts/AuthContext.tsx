"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  getAuthHeaders: () => ({}),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("asoc_token");
    if (stored) {
      setToken(stored);
    } else {
      fetchToken();
    }
  }, []);

  const fetchToken = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002"}/api/v1/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "dashboard-ui", role: "analyst", client_id: "web" }),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
        localStorage.setItem("asoc_token", data.access_token);
      }
    } catch {
      const devToken = process.env.NEXT_PUBLIC_WS_TOKEN || "my-SOC-agent-2001";
      setToken(devToken);
    }
  };

  const login = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem("asoc_token", newToken);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem("asoc_token");
  };

  const getAuthHeaders = (): Record<string, string> => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  };

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
