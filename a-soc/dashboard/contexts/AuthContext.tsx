"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, endpoints } from "@/lib/api";

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("asoc_token");
    if (stored) {
      setToken(stored);
      setLoading(false);
      return;
    }

    api.get<{ access_token: string }>(endpoints.auth.token())
      .then((data) => {
        if (data?.access_token) {
          setToken(data.access_token);
          localStorage.setItem("asoc_token", data.access_token);
        }
      })
      .catch(() => {
        const fallback = "my-SOC-agent-2001";
        setToken(fallback);
        localStorage.setItem("asoc_token", fallback);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((t: string) => {
    setToken(t);
    localStorage.setItem("asoc_token", t);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem("asoc_token");
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
