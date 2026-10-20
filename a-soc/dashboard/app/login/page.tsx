"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const PANEL_BG = "#0a0e1a";
const CARD_BG = "#0d1221";
const PANEL_BORDER = "#1e2a3a";
const CYAN = "#00e5ff";
const RED = "#ff3d3d";

export default function LoginPage() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginWithCredentials } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const success = await loginWithCredentials(userId, password);
    if (success) {
      router.push("/");
    } else {
      setError("Invalid credentials — access denied");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: PANEL_BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: 400,
          background: CARD_BG,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 12,
          padding: 40,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: CYAN,
              letterSpacing: "0.05em",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            A-SOC
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              marginTop: 4,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            Autonomous Security Operations Center
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 10,
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: 6,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="admin"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                background: PANEL_BG,
                border: `1px solid ${PANEL_BORDER}`,
                borderRadius: 6,
                color: "#e2e8f0",
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = CYAN)}
              onBlur={(e) => (e.target.style.borderColor = PANEL_BORDER)}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 10,
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: 6,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                background: PANEL_BG,
                border: `1px solid ${PANEL_BORDER}`,
                borderRadius: 6,
                color: "#e2e8f0",
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = CYAN)}
              onBlur={(e) => (e.target.style.borderColor = PANEL_BORDER)}
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              style={{
                padding: "8px 12px",
                background: `${RED}15`,
                border: `1px solid ${RED}40`,
                borderRadius: 6,
                color: RED,
                fontSize: 11,
                marginBottom: 16,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading || !userId || !password}
            style={{
              width: "100%",
              padding: "12px",
              background: loading || !userId || !password ? `${CYAN}30` : CYAN,
              border: "none",
              borderRadius: 6,
              color: loading || !userId || !password ? "#64748b" : PANEL_BG,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "'JetBrains Mono', monospace",
              cursor: loading || !userId || !password ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {loading ? "AUTHENTICATING..." : "ACCESS SYSTEM"}
          </button>
        </form>

        {/* Footer */}
        <div
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 9,
            color: "#475569",
            letterSpacing: "0.05em",
          }}
        >
          CLASSIFIED — AUTHORIZED PERSONNEL ONLY
        </div>
      </motion.div>
    </div>
  );
}
