"use client";

import { useState, useEffect, useCallback } from "react";
import { Database, Server, Monitor, Wifi, Cloud, Smartphone, AppWindow, Search, RefreshCw, Shield } from "lucide-react";
import { Shell } from "@/components/Shell";
import { endpoints, Asset, ApiError } from "@/lib/api";
import { severityBadge, statusBadge, formatDate, cn } from "@/lib/utils";

const typeIcons: Record<string, React.ElementType> = {
  server: Server, workstation: Monitor, network_device: Wifi,
  cloud_resource: Cloud, iot: Smartphone, application: AppWindow,
};

const demoAssets: Asset[] = [
  { id: "srv-001", name: "PROD-WEB-01", asset_type: "server", ip_address: "10.0.1.10", os: "Ubuntu 22.04", status: "online", risk_level: "medium", last_scan: new Date().toISOString(), vulnerabilities: 3, owner: "Platform Team", tags: ["production", "web"] },
  { id: "srv-002", name: "PROD-DB-01", asset_type: "server", ip_address: "10.0.1.20", os: "Ubuntu 22.04", status: "online", risk_level: "critical", last_scan: new Date().toISOString(), vulnerabilities: 7, owner: "Data Team", tags: ["production", "database"] },
  { id: "ws-001", name: "SECOP-WKS-042", asset_type: "workstation", ip_address: "10.0.5.42", os: "Windows 11", status: "online", risk_level: "low", last_scan: new Date().toISOString(), vulnerabilities: 0, owner: "SOC Analyst", tags: ["security-ops"] },
  { id: "net-001", name: "CORE-SW-01", asset_type: "network_device", ip_address: "10.0.0.1", os: "Cisco IOS XE", status: "online", risk_level: "high", last_scan: new Date().toISOString(), vulnerabilities: 5, owner: "Network Team", tags: ["core"] },
  { id: "cld-001", name: "AWS-EKS-PROD", asset_type: "cloud_resource", os: "Kubernetes 1.28", status: "online", risk_level: "medium", last_scan: new Date().toISOString(), vulnerabilities: 2, owner: "Cloud Team", tags: ["aws", "k8s"] },
  { id: "app-001", name: "A-SOC Backend", asset_type: "application", os: "Python 3.12", status: "online", risk_level: "low", last_scan: new Date().toISOString(), vulnerabilities: 0, owner: "Security Engineering", tags: ["a-soc"] },
];

export default function AssetInventoryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "100" };
      if (typeFilter) params.asset_type = typeFilter;
      if (riskFilter) params.risk_level = riskFilter;
      const data = await endpoints.assets(params);
      setAssets(data.assets?.length ? data.assets : demoAssets);
    } catch { setAssets(demoAssets); } finally { setLoading(false); }
  }, [typeFilter, riskFilter]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const filtered = assets.filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.ip_address?.includes(search) || a.tags.some((t) => t.includes(search.toLowerCase()))
  );

  const stats = {
    total: assets.length,
    critical: assets.filter((a) => a.risk_level === "critical").length,
    high: assets.filter((a) => a.risk_level === "high").length,
    compromised: assets.filter((a) => a.status === "compromised").length,
  };

  return (
    <Shell title="Asset Inventory" subtitle="Complete infrastructure inventory with risk assessment">
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card p-3 text-center"><p className="text-2xl font-bold text-white">{stats.total}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">TOTAL</p></div>
          <div className="glass-card card-critical p-3 text-center"><p className="text-2xl font-bold text-red-400">{stats.critical}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">CRITICAL</p></div>
          <div className="glass-card card-warning p-3 text-center"><p className="text-2xl font-bold text-orange-400">{stats.high}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">HIGH</p></div>
          <div className="glass-card p-3 text-center"><p className="text-2xl font-bold text-purple-400">{stats.compromised}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">COMPROMISED</p></div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, IP, or tag..." className="input pl-10" aria-label="Search assets" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="select w-36" aria-label="Asset type filter">
            <option value="">All Types</option>
            <option value="server">Servers</option>
            <option value="workstation">Workstations</option>
            <option value="network_device">Network</option>
            <option value="cloud_resource">Cloud</option>
            <option value="application">Apps</option>
          </select>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="select w-36" aria-label="Risk level filter">
            <option value="">All Risk</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Shield className="w-6 h-6 text-cyan-500 animate-pulse" /></div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th><th>Type</th><th>IP / OS</th><th>Status</th><th>Risk</th><th>Vulns</th><th>Owner</th><th>Last Scan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((asset) => {
                  const Icon = typeIcons[asset.asset_type] || Server;
                  return (
                    <tr key={asset.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-slate-800 rounded-md"><Icon className="w-3.5 h-3.5 text-cyan-400" /></div>
                          <div>
                            <p className="text-white text-sm font-medium">{asset.name}</p>
                            <p className="text-slate-600 text-[10px] font-mono">{asset.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs font-mono">{asset.asset_type.replace("_", " ")}</td>
                      <td>
                        <p className="text-slate-300 font-mono text-xs">{asset.ip_address || "—"}</p>
                        <p className="text-slate-600 text-[10px]">{asset.os || ""}</p>
                      </td>
                      <td><span className={statusBadge(asset.status)}>{asset.status}</span></td>
                      <td><span className={severityBadge(asset.risk_level)}>{asset.risk_level}</span></td>
                      <td className="text-center"><span className={cn("font-mono text-sm", asset.vulnerabilities > 0 ? "text-orange-400" : "text-emerald-400")}>{asset.vulnerabilities}</span></td>
                      <td className="text-xs">{asset.owner || "—"}</td>
                      <td className="text-xs font-mono text-slate-500">{formatDate(asset.last_scan)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
