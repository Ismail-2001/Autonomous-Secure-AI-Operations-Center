"use client";

import React, { useState, useEffect, useCallback } from "react";
import Shell from "@/components/Shell";
import { api, endpoints, type ForensicsJob } from "@/lib/api";
import { statusBadge, timeAgo, severityColor } from "@/lib/utils";

export default function ForensicsLabPage() {
  const [jobs, setJobs] = useState<ForensicsJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ jobs: ForensicsJob[] }>(endpoints.forensics());
      setJobs(data.jobs || []);
    } catch (_e) {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const filtered = jobs.filter((j) => !statusFilter || j.status === statusFilter);

  const jobTypeIcons: Record<string, string> = {
    memory_analysis: "🧠",
    disk_analysis: "💾",
    network_capture: "🌐",
    log_correlation: "📊",
    evidence_collection: "🔍",
    timeline_reconstruction: "⏰",
  };

  const statusColors: Record<string, string> = {
    completed: "#22c55e",
    running: "#06b6d4",
    queued: "#f59e0b",
    failed: "#ef4444",
  };

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "fade-in 0.4s ease" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", marginBottom: 4 }}>Forensics Lab</h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>Investigation workspace — evidence, findings, and chain of custody</p>
        </div>

        {/* Stats Row */}
        <div className="grid-4">
          {[
            { label: "Total Jobs", value: jobs.length, color: "#06b6d4" },
            { label: "Completed", value: jobs.filter((j) => j.status === "completed").length, color: "#22c55e" },
            { label: "Running", value: jobs.filter((j) => j.status === "running").length, color: "#3b82f6" },
            { label: "Failed", value: jobs.filter((j) => j.status === "failed").length, color: "#ef4444" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: stat.color, boxShadow: `0 0 8px ${stat.color}44` }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "JetBrains Mono, monospace", color: "#f8fafc" }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="glass-panel" style={{ padding: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Filter:</span>
          {["", "queued", "running", "completed", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`btn-sm ${statusFilter === s ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: 11 }}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        {/* Jobs List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 100, borderRadius: 10 }} />
            ))
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <h3>No forensics jobs</h3>
              <p>Jobs will appear here when investigations are initiated</p>
            </div>
          ) : (
            filtered.map((job) => (
              <div
                key={job.id}
                className={`glass-card ${job.status === "failed" ? "card-critical" : job.status === "running" ? "card-info" : ""}`}
                style={{ padding: 16, cursor: "pointer" }}
                onClick={() => setExpanded(expanded === job.id ? null : job.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{jobTypeIcons[job.type] || "🔬"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{job.title}</span>
                      <span className={statusBadge(job.status)}>{job.status}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#64748b" }}>
                      <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{job.id}</span>
                      <span>•</span>
                      <span>{timeAgo(job.created_at)}</span>
                      {job.agent && (
                        <>
                          <span>•</span>
                          <span style={{ color: "#06b6d4" }}>{job.agent}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {job.status === "running" && (
                      <div style={{ width: 20, height: 20, border: "2px solid rgba(6, 182, 212, 0.2)", borderTopColor: "#06b6d4", borderRadius: "50%", animation: "spin-slow 1s linear infinite" }} />
                    )}
                    <svg
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#64748b"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ transform: expanded === job.id ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Details */}
                {expanded === job.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(51, 65, 85, 0.3)", animation: "slide-up 0.2s ease" }}>
                    {/* Findings */}
                    {job.findings && job.findings.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                          Findings ({job.findings.length})
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {job.findings.map((f, i) => (
                            <div key={i} style={{ padding: "8px 12px", background: "rgba(2, 6, 23, 0.5)", borderRadius: 6, border: "1px solid rgba(51, 65, 85, 0.3)", fontSize: 12, color: "#94a3b8" }}>
                              <span style={{ color: "#ef4444", marginRight: 8 }}>▸</span>{f}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Artifacts */}
                    {job.artifacts && job.artifacts.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                          Artifacts ({job.artifacts.length})
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {job.artifacts.map((a, i) => (
                            <span key={i} className="badge badge-neutral" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>
                              📎 {a}
                            </span>
                          ))}
                        </div>
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
