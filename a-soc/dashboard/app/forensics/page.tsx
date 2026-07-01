"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", marginBottom: 4 }}>Forensics Lab</h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>Investigation workspace — evidence, findings, and chain of custody</p>
        </motion.div>

        {/* Stats Row */}
        <div className="grid-4">
          {[
            { label: "Total Jobs", value: jobs.length, color: "#06b6d4", delay: 0 },
            { label: "Completed", value: jobs.filter((j) => j.status === "completed").length, color: "#22c55e", delay: 0.1 },
            { label: "Running", value: jobs.filter((j) => j.status === "running").length, color: "#3b82f6", delay: 0.2 },
            { label: "Failed", value: jobs.filter((j) => j.status === "failed").length, color: "#ef4444", delay: 0.3 },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: stat.delay }}
              className="glass-card"
              style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: stat.delay }}
                style={{ width: 10, height: 10, borderRadius: "50%", background: stat.color, boxShadow: `0 0 8px ${stat.color}44` }}
              />
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "JetBrains Mono, monospace", color: "#f8fafc" }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="glass-panel"
          style={{ padding: 12, display: "flex", gap: 8, alignItems: "center" }}
        >
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Filter:</span>
          {["", "queued", "running", "completed", "failed"].map((s) => (
            <motion.button
              key={s}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStatusFilter(s)}
              className={`btn-sm ${statusFilter === s ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: 11 }}
            >
              {s || "All"}
            </motion.button>
          ))}
        </motion.div>

        {/* Jobs List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className="skeleton"
                style={{ height: 100, borderRadius: 10 }}
              />
            ))
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <h3>No forensics jobs</h3>
              <p>Jobs will appear here when investigations are initiated</p>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
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
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          style={{ width: 20, height: 20, border: "2px solid rgba(6, 182, 212, 0.2)", borderTopColor: "#06b6d4", borderRadius: "50%" }}
                        />
                      )}
                      <motion.svg
                        width={16}
                        height={16}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#64748b"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        animate={{ rotate: expanded === job.id ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </motion.svg>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expanded === job.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(51, 65, 85, 0.3)", overflow: "hidden" }}
                      >
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
