"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Shell from "@/components/Shell";
import { api, endpoints, type ThreatEvent } from "@/lib/api";
import { severityBadge, timeAgo, severityColor } from "@/lib/utils";

export default function ThreatHuntingPage() {
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ events: ThreatEvent[] }>(endpoints.searchEvents());
      setEvents(data.events || []);
    } catch (_e) {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filtered = events.filter((e) => {
    if (severity && e.severity !== severity) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        e.description?.toLowerCase().includes(q) ||
        e.source?.toLowerCase().includes(q) ||
        e.type?.toLowerCase().includes(q) ||
        e.id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", marginBottom: 4 }}>Threat Hunting</h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>Search, investigate, and correlate security events</p>
        </motion.div>

        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass-panel"
          style={{ padding: 16, display: "flex", gap: 12, alignItems: "center" }}
        >
          <div className="search-bar" style={{ flex: 1 }}>
            <svg className="search-icon" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={11} cy={11} r={8} />
              <line x1={21} y1={21} x2="16.65" y2="16.65" />
            </svg>
            <input
              className="input input-mono"
              placeholder="Search events... (source, type, description)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="select" style={{ width: 160 }} value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchEvents}
            className="btn-primary btn-sm"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
            Refresh
          </motion.button>
        </motion.div>

        {/* Events List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className="skeleton"
                style={{ height: 80, borderRadius: 10 }}
              />
            ))
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx={11} cy={11} r={8} />
                <line x1={21} y1={21} x2="16.65" y2="16.65" />
              </svg>
              <h3>No events found</h3>
              <p>Try adjusting your search query or filters</p>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((evt, i) => (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="glass-card"
                  style={{ padding: 14, cursor: "pointer" }}
                  onClick={() => setExpanded(expanded === evt.id ? null : evt.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 4, height: 36, borderRadius: 2, background: severityColor(evt.severity), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span className={severityBadge(evt.severity)}>{evt.severity}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {evt.type || "Unknown Event"}
                        </span>
                        <span style={{ fontSize: 11, color: "#475569", fontFamily: "JetBrains Mono, monospace", marginLeft: "auto", flexShrink: 0 }}>
                          {timeAgo(evt.timestamp)}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {evt.description}
                      </p>
                    </div>
                    <motion.svg
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#64748b"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      animate={{ rotate: expanded === evt.id ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ flexShrink: 0 }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </motion.svg>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expanded === evt.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(51, 65, 85, 0.3)", overflow: "hidden" }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Event ID</div>
                            <div style={{ fontSize: 12, color: "#06b6d4", fontFamily: "JetBrains Mono, monospace" }}>{evt.id}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Source</div>
                            <div style={{ fontSize: 12, color: "#f8fafc" }}>{evt.source}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Agent</div>
                            <div style={{ fontSize: 12, color: "#f8fafc" }}>{evt.agent || "N/A"}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Confidence</div>
                            <div style={{ fontSize: 12, color: "#f8fafc" }}>{evt.confidence ? `${(evt.confidence * 100).toFixed(0)}%` : "N/A"}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Mitigated</div>
                            <div style={{ fontSize: 12, color: evt.mitigated ? "#22c55e" : "#ef4444" }}>{evt.mitigated ? "Yes" : "No"}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Timestamp</div>
                            <div style={{ fontSize: 12, color: "#f8fafc", fontFamily: "JetBrains Mono, monospace" }}>{new Date(evt.timestamp).toLocaleString()}</div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </Shell>
  );
}
