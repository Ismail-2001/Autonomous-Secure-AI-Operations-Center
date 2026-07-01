"use client";

import React, { useState, useEffect, useCallback } from "react";
import Shell from "@/components/Shell";
import { api, endpoints, type ThreatIndicator } from "@/lib/api";
import { severityBadge, timeAgo, severityColor } from "@/lib/utils";

export default function ThreatIntelPage() {
  const [indicators, setIndicators] = useState<ThreatIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [tlpFilter, setTlpFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const fetchIndicators = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ indicators: ThreatIndicator[] }>(endpoints.threatIntel());
      setIndicators(data.indicators || []);
    } catch (_e) {
      setIndicators([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIndicators(); }, [fetchIndicators]);

  const filtered = indicators.filter((i) => {
    if (typeFilter && i.type !== typeFilter) return false;
    if (tlpFilter && i.tlp !== tlpFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return i.value.toLowerCase().includes(q) || i.source.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q));
    }
    return true;
  });

  const tlpColors: Record<string, string> = {
    red: "#ef4444",
    amber: "#f59e0b",
    green: "#22c55e",
    white: "#e2e8f0",
  };

  const iocTypeIcons: Record<string, string> = {
    ip: "🌐",
    domain: "🔗",
    hash: "#️⃣",
    url: "🌍",
    email: "📧",
  };

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fade-in 0.4s ease" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", marginBottom: 4 }}>Threat Intelligence Center</h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>IOC database, threat actors, and intelligence feeds</p>
        </div>

        {/* Stats */}
        <div className="grid-4">
          {[
            { label: "Total IOCs", value: indicators.length, color: "#06b6d4" },
            { label: "Critical", value: indicators.filter((i) => i.severity === "critical").length, color: "#ef4444" },
            { label: "High", value: indicators.filter((i) => i.severity === "high").length, color: "#f97316" },
            { label: "TLP:Red", value: indicators.filter((i) => i.tlp === "red").length, color: "#ef4444" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "JetBrains Mono, monospace", color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="glass-panel" style={{ padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <svg className="search-icon" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={11} cy={11} r={8} />
              <line x1={21} y1={21} x2="16.65" y2="16.65" />
            </svg>
            <input className="input input-mono" placeholder="Search IOCs..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="select" style={{ width: 140 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="ip">IP Address</option>
            <option value="domain">Domain</option>
            <option value="hash">Hash</option>
            <option value="url">URL</option>
            <option value="email">Email</option>
          </select>
          <select className="select" style={{ width: 140 }} value={tlpFilter} onChange={(e) => setTlpFilter(e.target.value)}>
            <option value="">All TLP</option>
            <option value="red">TLP:RED</option>
            <option value="amber">TLP:AMBER</option>
            <option value="green">TLP:GREEN</option>
            <option value="white">TLP:WHITE</option>
          </select>
        </div>

        {/* IOC List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />
            ))
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <h3>No indicators found</h3>
              <p>IOCs will appear here as they are ingested from threat feeds</p>
            </div>
          ) : (
            filtered.map((ioc) => (
              <div
                key={ioc.id}
                className="glass-card"
                style={{ padding: 14, cursor: "pointer" }}
                onClick={() => setExpanded(expanded === ioc.id ? null : ioc.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{iocTypeIcons[ioc.type] || "❓"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>
                        {ioc.value}
                      </span>
                      <span className={`tlp-${ioc.tlp}`} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3 }}>
                        TLP:{ioc.tlp.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#64748b" }}>
                      <span className={severityBadge(ioc.severity)}>{ioc.severity}</span>
                      <span>Source: <span style={{ color: "#94a3b8" }}>{ioc.source}</span></span>
                      <span>Confidence: <span style={{ color: ioc.confidence >= 80 ? "#22c55e" : ioc.confidence >= 50 ? "#f59e0b" : "#ef4444" }}>{ioc.confidence}%</span></span>
                      <span style={{ marginLeft: "auto" }}>{timeAgo(ioc.last_seen)}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expanded === ioc.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(51, 65, 85, 0.3)", animation: "slide-up 0.2s ease" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Type</div>
                        <div style={{ fontSize: 12, color: "#f8fafc", textTransform: "capitalize" }}>{ioc.type}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>First Seen</div>
                        <div style={{ fontSize: 12, color: "#f8fafc", fontFamily: "JetBrains Mono, monospace" }}>{new Date(ioc.first_seen).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Last Seen</div>
                        <div style={{ fontSize: 12, color: "#f8fafc", fontFamily: "JetBrains Mono, monospace" }}>{new Date(ioc.last_seen).toLocaleDateString()}</div>
                      </div>
                    </div>
                    {ioc.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {ioc.tags.map((tag) => (
                          <span key={tag} className="badge badge-cyan" style={{ fontSize: 9 }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Shell>
  );
}
