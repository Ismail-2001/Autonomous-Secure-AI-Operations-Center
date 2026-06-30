"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe, RefreshCw, Shield, Search, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Shell } from "@/components/Shell";
import { endpoints, ThreatIndicator } from "@/lib/api";
import { severityBadge, formatDate, cn } from "@/lib/utils";

const tlpColors: Record<string, string> = {
  red: "bg-red-500/20 text-red-400 border-red-500/30",
  amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  green: "bg-green-500/20 text-green-400 border-green-500/30",
  white: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const demo: ThreatIndicator[] = [
  { id: "ioc-001", type: "ip", value: "198.51.100.42", confidence: 0.92, severity: "critical", tlp: "red", source: "CrowdStrike Intel", first_seen: new Date(Date.now() - 86400000 * 3).toISOString(), last_seen: new Date().toISOString(), tags: ["apt29", "c2"], description: "Known C2 server associated with APT29" },
  { id: "ioc-002", type: "hash", value: "a1b2c3d4e5f678901234567890123456", confidence: 0.87, severity: "high", tlp: "amber", source: "VirusTotal", first_seen: new Date(Date.now() - 86400000 * 7).toISOString(), last_seen: new Date(Date.now() - 86400000).toISOString(), tags: ["ransomware", "lockbit"], description: "LockBit 3.0 ransomware sample" },
  { id: "ioc-003", type: "domain", value: "evil-update.com", confidence: 0.78, severity: "high", tlp: "amber", source: "AlienVault OTX", first_seen: new Date(Date.now() - 86400000 * 14).toISOString(), last_seen: new Date(Date.now() - 86400000 * 2).toISOString(), tags: ["phishing"], description: "Phishing domain mimicking software updates" },
  { id: "ioc-004", type: "url", value: "https://malware-host.xyz/payload.exe", confidence: 0.95, severity: "critical", tlp: "red", source: "URLhaus", first_seen: new Date(Date.now() - 3600000 * 6).toISOString(), last_seen: new Date().toISOString(), tags: ["malware-dropper"], description: "Active malware distribution URL" },
  { id: "ioc-005", type: "email", value: "phish@spoofed.com", confidence: 0.72, severity: "medium", tlp: "green", source: "PhishTank", first_seen: new Date(Date.now() - 86400000 * 5).toISOString(), last_seen: new Date(Date.now() - 86400000).toISOString(), tags: ["bec"], description: "BEC phishing sender address" },
];

export default function ThreatIntelPage() {
  const [indicators, setIndicators] = useState<ThreatIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [tlpFilter, setTlpFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchIntel = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "100" };
      if (tlpFilter) params.tlp = tlpFilter;
      const data = await endpoints.threatIntel(params);
      setIndicators(data.indicators?.length ? data.indicators : demo);
    } catch { setIndicators(demo); } finally { setLoading(false); }
  }, [tlpFilter]);

  useEffect(() => { fetchIntel(); }, [fetchIntel]);

  const filtered = indicators.filter((i) => {
    if (typeFilter && i.type !== typeFilter) return false;
    if (search && !i.value.toLowerCase().includes(search.toLowerCase()) && !i.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Shell title="Threat Intelligence" subtitle="Indicators of Compromise from multiple threat feeds">
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card p-3 text-center"><p className="text-2xl font-bold text-white">{indicators.length}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">TOTAL IOCs</p></div>
          <div className="glass-card card-critical p-3 text-center"><p className="text-2xl font-bold text-red-400">{indicators.filter((i) => i.severity === "critical").length}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">CRITICAL</p></div>
          <div className="glass-card card-warning p-3 text-center"><p className="text-2xl font-bold text-orange-400">{indicators.filter((i) => i.severity === "high").length}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">HIGH</p></div>
          <div className="glass-card p-3 text-center border-cyan-500/20"><p className="text-2xl font-bold text-cyan-400">{indicators.filter((i) => new Date(i.last_seen).getTime() > Date.now() - 86400000).length}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">SEEN 24H</p></div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search IOCs by value, description, or tag..." className="input pl-10" aria-label="Search IOCs" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="select w-36" aria-label="IOC type filter">
            <option value="">All Types</option><option value="ip">IP</option><option value="domain">Domain</option><option value="hash">Hash</option><option value="url">URL</option><option value="email">Email</option>
          </select>
          <select value={tlpFilter} onChange={(e) => setTlpFilter(e.target.value)} className="select w-36" aria-label="TLP filter">
            <option value="">All TLP</option><option value="red">TLP:RED</option><option value="amber">TLP:AMBER</option><option value="green">TLP:GREEN</option><option value="white">TLP:WHITE</option>
          </select>
          <button onClick={fetchIntel} className="btn-primary"><RefreshCw className="w-3.5 h-3.5" /> Sync</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Shield className="w-6 h-6 text-cyan-500 animate-pulse" /></div>
        ) : (
          <div className="space-y-2">
            {filtered.map((ioc) => (
              <div key={ioc.id} className="glass-card p-4 cursor-pointer hover:border-slate-600 transition-colors"
                onClick={() => setExpanded(expanded === ioc.id ? null : ioc.id)}
                role="button" tabIndex={0} aria-expanded={expanded === ioc.id}
                onKeyDown={(e) => e.key === "Enter" && setExpanded(expanded === ioc.id ? null : ioc.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={severityBadge(ioc.severity)}>{ioc.severity}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-sm">{ioc.value}</span>
                        <span className="text-slate-600 text-[10px] font-mono">({ioc.type.toUpperCase()})</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5 truncate">{ioc.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("badge border", tlpColors[ioc.tlp] || "")}>TLP:{ioc.tlp.toUpperCase()}</span>
                      <span className="text-xs font-mono text-slate-500">{(ioc.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  {expanded === ioc.id ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0 ml-2" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />}
                </div>
                {expanded === ioc.id && (
                  <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                    <div><span className="text-slate-500">Source</span><p className="text-slate-300 mt-0.5">{ioc.source}</p></div>
                    <div><span className="text-slate-500">First Seen</span><p className="text-slate-300 mt-0.5">{formatDate(ioc.first_seen)}</p></div>
                    <div><span className="text-slate-500">Last Seen</span><p className="text-slate-300 mt-0.5">{formatDate(ioc.last_seen)}</p></div>
                    <div><span className="text-slate-500">Confidence</span><p className="text-slate-300 mt-0.5">{(ioc.confidence * 100).toFixed(0)}%</p></div>
                    <div className="col-span-2 md:col-span-4"><span className="text-slate-500">Tags</span><div className="flex gap-1 mt-1 flex-wrap">{ioc.tags.map((t, i) => <span key={i} className="badge badge-neutral">{t}</span>)}</div></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
