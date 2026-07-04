"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, endpoints } from "@/lib/api";

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  loginWithCredentials: (userId: string, password: string) => Promise<boolean>;
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
    }
    setLoading(false);
  }, []);

  const login = useCallback((t: string) => {
    setToken(t);
    localStorage.setItem("asoc_token", t);
  }, []);

  const loginWithCredentials = useCallback(async (userId: string, password: string): Promise<boolean> => {
    try {
      const data = await api.post<{ access_token: string }>(endpoints.auth.token(), {
        user_id: userId,
        password: password,
      });
      if (data?.access_token) {
        setToken(data.access_token);
        localStorage.setItem("asoc_token", data.access_token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem("asoc_token");
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, loginWithCredentials, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
