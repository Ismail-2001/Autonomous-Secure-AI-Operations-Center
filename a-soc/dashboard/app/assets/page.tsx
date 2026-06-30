"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Database, Server, Monitor, Wifi, Cloud, Smartphone, AppWindow,
  RefreshCw, Shield, AlertTriangle, CheckCircle, Wrench, Search,
  Globe, Lock
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { api, Asset, ApiError } from "@/lib/api";
import { severityColor, statusColor, formatDate } from "@/lib/utils";

const assetTypeIcons: Record<string, React.ElementType> = {
  server: Server,
  workstation: Monitor,
  network_device: Wifi,
  cloud_resource: Cloud,
  iot: Smartphone,
  application: AppWindow,
};

const demoAssets: Asset[] = [
  { id: "srv-001", name: "PROD-WEB-01", asset_type: "server", ip_address: "10.0.1.10", os: "Ubuntu 22.04", status: "online", risk_level: "medium", last_scan: new Date().toISOString(), vulnerabilities: 3, owner: "Platform Team", tags: ["production", "web", "nginx"] },
  { id: "srv-002", name: "PROD-DB-01", asset_type: "server", ip_address: "10.0.1.20", os: "Ubuntu 22.04", status: "online", risk_level: "critical", last_scan: new Date().toISOString(), vulnerabilities: 7, owner: "Data Team", tags: ["production", "database", "postgresql"] },
  { id: "ws-001", name: "SECOP-WKS-042", asset_type: "workstation", ip_address: "10.0.5.42", os: "Windows 11", status: "online", risk_level: "low", last_scan: new Date().toISOString(), vulnerabilities: 0, owner: "SOC Analyst", tags: ["security-ops"] },
  { id: "net-001", name: "CORE-SW-01", asset_type: "network_device", ip_address: "10.0.0.1", os: "Cisco IOS XE", status: "online", risk_level: "high", last_scan: new Date().toISOString(), vulnerabilities: 5, owner: "Network Team", tags: ["core", "switch"] },
  { id: "cld-001", name: "AWS-EKS-PROD", asset_type: "cloud_resource", os: "Kubernetes 1.28", status: "online", risk_level: "medium", last_scan: new Date().toISOString(), vulnerabilities: 2, owner: "Cloud Team", tags: ["aws", "eks", "kubernetes"] },
  { id: "app-001", name: "A-SOC Backend", asset_type: "application", os: "Python 3.12 / FastAPI", status: "online", risk_level: "low", last_scan: new Date().toISOString(), vulnerabilities: 0, owner: "Security Engineering", tags: ["a-soc", "api"] },
];

export default function AssetInventoryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAssets({ asset_type: typeFilter || undefined, risk_level: riskFilter || undefined, limit: 100 });
      setAssets(data.assets?.length ? data.assets : demoAssets);
    } catch {
      setAssets(demoAssets);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, riskFilter]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const filteredAssets = assets.filter(a =>
    !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.ip_address?.includes(searchQuery) ||
    a.tags.some(t => t.includes(searchQuery.toLowerCase()))
  );

  const stats = {
    total: assets.length,
    critical: assets.filter(a => a.risk_level === "critical").length,
    high: assets.filter(a => a.risk_level === "high").length,
    compromised: assets.filter(a => a.status === "compromised").length,
  };

  return (
    <Shell>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Database className="w-6 h-6 text-cyan-400" />
              Asset Inventory
            </h1>
            <p className="text-slate-500 text-sm mt-1">Complete inventory of all monitored infrastructure and applications</p>
          </div>
          <button onClick={fetchAssets} className="cyber-button flex items-center gap-2 text-sm !py-2 !px-4">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="cyber-card p-4 text-center">
            <p className="text-3xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">TOTAL ASSETS</p>
          </div>
          <div className="cyber-card p-4 text-center border-red-500/30">
            <p className="text-3xl font-bold text-red-400">{stats.critical}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">CRITICAL RISK</p>
          </div>
          <div className="cyber-card p-4 text-center border-orange-500/30">
            <p className="text-3xl font-bold text-orange-400">{stats.high}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">HIGH RISK</p>
          </div>
          <div className="cyber-card p-4 text-center border-purple-500/30">
            <p className="text-3xl font-bold text-purple-400">{stats.compromised}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">COMPROMISED</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, IP, or tag..."
              className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono text-sm"
            />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none font-mono text-sm">
            <option value="">All Types</option>
            <option value="server">Servers</option>
            <option value="workstation">Workstations</option>
            <option value="network_device">Network</option>
            <option value="cloud_resource">Cloud</option>
            <option value="iot">IoT</option>
            <option value="application">Applications</option>
          </select>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none font-mono text-sm">
            <option value="">All Risk Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Shield className="w-8 h-8 text-cyan-500 animate-pulse" />
            <span className="ml-3 font-mono text-cyan-500 text-sm">Scanning assets...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">Asset</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">Type</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">IP / OS</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">Status</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">Risk</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">Vulns</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">Owner</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">Last Scan</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => {
                  const TypeIcon = assetTypeIcons[asset.asset_type] || Server;
                  return (
                    <tr key={asset.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-800 rounded-lg">
                            <TypeIcon className="w-4 h-4 text-cyan-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{asset.name}</p>
                            <p className="text-slate-500 text-xs font-mono">{asset.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-xs">{asset.asset_type.replace("_", " ")}</td>
                      <td className="py-3 px-4">
                        <p className="text-slate-300 font-mono text-xs">{asset.ip_address || "N/A"}</p>
                        <p className="text-slate-500 text-xs">{asset.os || ""}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-bold border ${statusColor(asset.status)}`}>
                          {asset.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-bold border ${severityColor(asset.risk_level)}`}>
                          {asset.risk_level.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-mono text-sm ${asset.vulnerabilities > 0 ? "text-orange-400" : "text-emerald-400"}`}>
                          {asset.vulnerabilities}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">{asset.owner || "—"}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs font-mono">{formatDate(asset.last_scan)}</td>
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
