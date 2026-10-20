"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#020617",
          color: "#f8fafc",
          fontFamily: "Inter, sans-serif",
          padding: "24px",
          textAlign: "center",
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            marginBottom: 20,
          }}>
            ⚠️
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            System Error Detected
          </h2>
          <p style={{ color: "#94a3b8", maxWidth: 420, marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
            {this.state.error?.message || "An unexpected error occurred in the A-SOC platform."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            style={{
              padding: "10px 24px",
              background: "linear-gradient(135deg, #06b6d4, #0891b2)",
              color: "#fff",
              border: "1px solid rgba(6, 182, 212, 0.4)",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Reload System
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
