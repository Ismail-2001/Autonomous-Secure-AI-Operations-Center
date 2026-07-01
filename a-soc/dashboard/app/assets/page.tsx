"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Shell from "@/components/Shell";
import { api, endpoints, type Asset } from "@/lib/api";
import { statusBadge, riskColor, timeAgo } from "@/lib/utils";

export default function AssetInventoryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<keyof Asset>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ assets: Asset[] }>(endpoints.assets());
      setAssets(data.assets || []);
    } catch (_e) {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const filtered = assets
    .filter((a) => {
      if (typeFilter && a.type !== typeFilter) return false;
      if (riskFilter) {
        if (riskFilter === "critical" && a.risk_score < 80) return false;
        if (riskFilter === "high" && (a.risk_score < 60 || a.risk_score >= 80)) return false;
        if (riskFilter === "medium" && (a.risk_score < 40 || a.risk_score >= 60)) return false;
        if (riskFilter === "low" && a.risk_score >= 40) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

  const handleSort = (key: keyof Asset) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const typeColors: Record<string, string> = {
    server: "#3b82f6",
    workstation: "#8b5cf6",
    network: "#06b6d4",
    cloud: "#f59e0b",
    iot: "#22c55e",
    app: "#f97316",
  };

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", marginBottom: 4 }}>Asset Inventory</h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>Infrastructure assets, risk scores, and vulnerability tracking</p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass-panel"
          style={{ padding: 16, display: "flex", gap: 12, alignItems: "center" }}
        >
          <select className="select" style={{ width: 160 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="server">Server</option>
            <option value="workstation">Workstation</option>
            <option value="network">Network</option>
            <option value="cloud">Cloud</option>
            <option value="iot">IoT</option>
            <option value="app">Application</option>
          </select>
          <select className="select" style={{ width: 160 }} value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="">All Risk Levels</option>
            <option value="critical">Critical (80+)</option>
            <option value="high">High (60-79)</option>
            <option value="medium">Medium (40-59)</option>
            <option value="low">Low (&lt;40)</option>
          </select>
          <span style={{ fontSize: 12, color: "#64748b", marginLeft: "auto" }}>
            {filtered.length} assets
          </span>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="glass-panel"
          style={{ overflow: "hidden" }}
        >
          {loading ? (
            <div style={{ padding: 24 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 6 }} />
              ))}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {[
                      { key: "name", label: "Asset" },
                      { key: "type", label: "Type" },
                      { key: "ip_address", label: "IP / OS" },
                      { key: "status", label: "Status" },
                      { key: "risk_score", label: "Risk" },
                      { key: "vulnerabilities", label: "Vulns" },
                      { key: "owner", label: "Owner" },
                      { key: "last_scan", label: "Last Scan" },
                    ].map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key as keyof Asset)}
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        {col.label}
                        {sortKey === col.key && (
                          <span style={{ marginLeft: 4, color: "#06b6d4" }}>
                            {sortDir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((asset, i) => (
                    <motion.tr
                      key={asset.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setSelectedAsset(asset)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: riskColor(asset.risk_score),
                            boxShadow: `0 0 6px ${riskColor(asset.risk_score)}44`,
                            flexShrink: 0,
                          }} />
                          <span style={{ fontWeight: 600, color: "#f8fafc" }}>{asset.name}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: typeColors[asset.type] || "#64748b",
                          background: `${typeColors[asset.type] || "#64748b"}15`,
                          padding: "2px 8px",
                          borderRadius: 4,
                          textTransform: "capitalize",
                        }}>
                          {asset.type}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "#94a3b8" }}>
                          {asset.ip_address}
                        </span>
                      </td>
                      <td>
                        <span className={statusBadge(asset.status)}>{asset.status}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 50, height: 4, background: "var(--bg-hover)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${asset.risk_score}%`, height: "100%", background: riskColor(asset.risk_score), borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: riskColor(asset.risk_score), fontWeight: 600 }}>
                            {asset.risk_score}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 12,
                          fontFamily: "JetBrains Mono, monospace",
                          color: asset.vulnerabilities > 5 ? "#ef4444" : asset.vulnerabilities > 0 ? "#f59e0b" : "#22c55e",
                          fontWeight: 600,
                        }}>
                          {asset.vulnerabilities}
                        </span>
                      </td>
                      <td style={{ color: "#94a3b8", fontSize: 12 }}>{asset.owner || "—"}</td>
                      <td style={{ color: "#64748b", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>
                        {asset.last_scan ? timeAgo(asset.last_scan) : "—"}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Asset Detail Modal */}
        <AnimatePresence>
          {selectedAsset && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="modal-overlay"
              onClick={() => setSelectedAsset(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 600 }}
              >
                <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(51, 65, 85, 0.5)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>{selectedAsset.name}</h2>
                    <p style={{ fontSize: 12, color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>{selectedAsset.id}</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedAsset(null)}
                    className="btn-icon"
                  >
                    ✕
                  </motion.button>
                </div>
                <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[
                    { label: "Type", value: selectedAsset.type, color: typeColors[selectedAsset.type] || "#94a3b8" },
                    { label: "IP Address", value: selectedAsset.ip_address, mono: true },
                    { label: "OS", value: selectedAsset.os || "Unknown" },
                    { label: "Status", value: selectedAsset.status },
                    { label: "Risk Score", value: `${selectedAsset.risk_score}/100`, color: riskColor(selectedAsset.risk_score) },
                    { label: "Vulnerabilities", value: String(selectedAsset.vulnerabilities), color: selectedAsset.vulnerabilities > 5 ? "#ef4444" : "#22c55e" },
                    { label: "Owner", value: selectedAsset.owner || "Unassigned" },
                    { label: "Location", value: selectedAsset.location || "Unknown" },
                  ].map((field) => (
                    <div key={field.label}>
                      <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{field.label}</div>
                      <div style={{ fontSize: 13, color: field.color || "#f8fafc", fontWeight: 600, fontFamily: field.mono ? "JetBrains Mono, monospace" : "inherit" }}>
                        {field.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(51, 65, 85, 0.5)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-ghost btn-sm">Scan Asset</motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-primary btn-sm">View Incidents</motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Shell>
  );
}
