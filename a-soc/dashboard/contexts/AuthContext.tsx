"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, endpoints } from "@/lib/api";

export type UserRole = "admin" | "supervisor" | "analyst" | "readonly";

interface AuthContextValue {
  token: string | null;
  role: UserRole;
  userId: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  loginWithCredentials: (userId: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseJwtPayload(token: string): { role?: string; sub?: string } | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("analyst");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const me = await api.get<{ user_id: string; role: string }>(endpoints.auth.me());
      setRole((me.role?.toLowerCase() as UserRole) || "analyst");
      setUserId(me.user_id);
    } catch {
      const payload = parseJwtPayload(token);
      if (payload) {
        setRole((payload.role?.toLowerCase() as UserRole) || "analyst");
        setUserId(payload.sub || null);
      }
    }
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem("asoc_token");
    if (stored) {
      setToken(stored);
      const payload = parseJwtPayload(stored);
      if (payload) {
        setRole((payload.role?.toLowerCase() as UserRole) || "analyst");
        setUserId(payload.sub || null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (token && !userId) {
      refreshUser();
    }
  }, [token, userId, refreshUser]);

  const login = useCallback((t: string) => {
    setToken(t);
    localStorage.setItem("asoc_token", t);
    const payload = parseJwtPayload(t);
    if (payload) {
      setRole((payload.role?.toLowerCase() as UserRole) || "analyst");
      setUserId(payload.sub || null);
    }
  }, []);

  const loginWithCredentials = useCallback(async (userId: string, password: string): Promise<boolean> => {
    try {
      // First try real production login endpoint
      const data = await api.post<{
        access_token: string;
        refresh_token?: string;
        user?: { username: string; role: string };
      }>(endpoints.auth.login(), {
        username: userId,
        password: password,
      });

      if (data?.access_token) {
        setToken(data.access_token);
        localStorage.setItem("asoc_token", data.access_token);
        if (data.refresh_token) {
          localStorage.setItem("asoc_refresh_token", data.refresh_token);
        }
        if (data.user) {
          setRole((data.user.role?.toLowerCase() as UserRole) || "analyst");
          setUserId(data.user.username);
        } else {
          const payload = parseJwtPayload(data.access_token);
          if (payload) {
            setRole((payload.role?.toLowerCase() as UserRole) || "analyst");
            setUserId(payload.sub || null);
          }
        }
        return true;
      }
      return false;
    } catch {
      // Development fallback if auth/login is not available or offline
      try {
        const devData = await api.post<{ access_token: string }>(endpoints.auth.token(), {
          user_id: userId,
          role: "admin",
        });
        if (devData?.access_token) {
          setToken(devData.access_token);
          localStorage.setItem("asoc_token", devData.access_token);
          setRole("admin");
          setUserId(userId);
          return true;
        }
      } catch {
        // Ignored fallback failure
      }
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem("asoc_refresh_token");
      await api.post(endpoints.auth.logout(), { refresh_token: refreshToken || "" });
    } catch {
      // Ignored logout network error
    } finally {
      setToken(null);
      setRole("analyst");
      setUserId(null);
      localStorage.removeItem("asoc_token");
      localStorage.removeItem("asoc_refresh_token");
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, role, userId, isAuthenticated: !!token, login, loginWithCredentials, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
