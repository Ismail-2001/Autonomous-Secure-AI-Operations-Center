"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe, RefreshCw, Shield, Search, ExternalLink, AlertTriangle,
  ChevronDown, ChevronUp, Filter
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { api, ThreatIndicator, ApiError } from "@/lib/api";
import { severityColor, formatDate } from "@/lib/utils";

const tlpColors: Record<string, string> = {
  red: "bg-red-500 text-white",
  amber: "bg-amber-500 text-black",
  green: "bg-green-500 text-white",
  white: "bg-white text-black",
};

const demoIndicators: ThreatIndicator[] = [
  { id: "ioc-001", type: "ip", value: "198.51.100.42", confidence: 0.92, severity: "critical", tlp: "red", source: "CrowdStrike Intel", first_seen: new Date(Date.now() - 86400000 * 3).toISOString(), last_seen: new Date().toISOString(), tags: ["apt29", "cozy-bear", "c2"], description: "Known C2 server associated with APT29/Cozy Bear operations" },
  { id: "ioc-002", type: "hash", value: "a1b2c3d4e5f678901234567890123456", confidence: 0.87, severity: "high", tlp: "amber", source: "VirusTotal", first_seen: new Date(Date.now() - 86400000 * 7).toISOString(), last_seen: new Date(Date.now() - 86400000).toISOString(), tags: ["malware", "ransomware", "lockbit"], description: "LockBit 3.0 ransomware sample hash" },
  { id: "ioc-003", type: "domain", value: "evil-update.com", confidence: 0.78, severity: "high", tlp: "amber", source: "AlienVault OTX", first_seen: new Date(Date.now() - 86400000 * 14).toISOString(), last_seen: new Date(Date.now() - 86400000 * 2).toISOString(), tags: ["phishing", "credential-harvest"], description: "Phishing domain mimicking legitimate software updates" },
  { id: "ioc-004", type: "url", value: "https://malware-host.xyz/payload.exe", confidence: 0.95, severity: "critical", tlp: "red", source: "URLhaus", first_seen: new Date(Date.now() - 3600000 * 6).toISOString(), last_seen: new Date().toISOString(), tags: ["malware-dropper", "emotet"], description: "Active malware distribution URL" },
  { id: "ioc-005", type: "email", value: "phish@spoofed-domain.com", confidence: 0.72, severity: "medium", tlp: "green", source: "PhishTank", first_seen: new Date(Date.now() - 86400000 * 5).toISOString(), last_seen: new Date(Date.now() - 86400000).toISOString(), tags: ["phishing", "business-email-compromise"], description: "BEC phishing sender address" },
];

export default function ThreatIntelPage() {
  const [indicators, setIndicators] = useState<ThreatIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIOC, setExpandedIOC] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [tlpFilter, setTlpFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchIndicators = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getThreatIntelligence({ tlp: tlpFilter || undefined, limit: 100 });
      setIndicators(data.indicators?.length ? data.indicators : demoIndicators);
    } catch {
      setIndicators(demoIndicators);
    } finally {
      setLoading(false);
    }
  }, [tlpFilter]);

  useEffect(() => { fetchIndicators(); }, [fetchIndicators]);

  const filteredIndicators = indicators.filter(ioc => {
    if (typeFilter && ioc.type !== typeFilter) return false;
    if (searchQuery && !ioc.value.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !ioc.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !ioc.tags.some(t => t.includes(searchQuery.toLowerCase()))) return false;
    return true;
  });

  const stats = {
    total: indicators.length,
    critical: indicators.filter(i => i.severity === "critical").length,
    high: indicators.filter(i => i.severity === "high").length,
    recent: indicators.filter(i => new Date(i.last_seen).getTime() > Date.now() - 86400000).length,
  };

  return (
    <Shell>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Globe className="w-6 h-6 text-cyan-400" />
              Threat Intelligence
            </h1>
            <p className="text-slate-500 text-sm mt-1">Indicators of Compromise (IOCs) from multiple threat feeds</p>
          </div>
          <button onClick={fetchIndicators} className="cyber-button flex items-center gap-2 text-sm !py-2 !px-4">
            <RefreshCw className="w-4 h-4" />
            Sync Feeds
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="cyber-card p-4 text-center">
            <p className="text-3xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">TOTAL IOCs</p>
          </div>
          <div className="cyber-card p-4 text-center border-red-500/30">
            <p className="text-3xl font-bold text-red-400">{stats.critical}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">CRITICAL</p>
          </div>
          <div className="cyber-card p-4 text-center border-orange-500/30">
            <p className="text-3xl font-bold text-orange-400">{stats.high}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">HIGH</p>
          </div>
          <div className="cyber-card p-4 text-center border-cyan-500/30">
            <p className="text-3xl font-bold text-cyan-400">{stats.recent}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">SEEN 24H</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search IOCs by value, description, or tag..."
              className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono text-sm"
            />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none font-mono text-sm">
            <option value="">All Types</option>
            <option value="ip">IP Address</option>
            <option value="domain">Domain</option>
            <option value="hash">Hash</option>
            <option value="url">URL</option>
            <option value="email">Email</option>
          </select>
          <select value={tlpFilter} onChange={(e) => setTlpFilter(e.target.value)} className="px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none font-mono text-sm">
            <option value="">All TLP</option>
            <option value="red">TLP:RED</option>
            <option value="amber">TLP:AMBER</option>
            <option value="green">TLP:GREEN</option>
            <option value="white">TLP:WHITE</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Shield className="w-8 h-8 text-cyan-500 animate-pulse" />
            <span className="ml-3 font-mono text-cyan-500 text-sm">Fetching threat feeds...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredIndicators.map((ioc) => (
              <div key={ioc.id} className="cyber-card p-4 cursor-pointer hover:border-slate-600 transition-colors"
                onClick={() => setExpandedIOC(expandedIOC === ioc.id ? null : ioc.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-bold border ${severityColor(ioc.severity)}`}>
                      {ioc.severity.toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-sm font-medium">{ioc.value}</span>
                        <span className="text-slate-600 text-xs font-mono">({ioc.type.toUpperCase()})</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">{ioc.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tlpColors[ioc.tlp] || "bg-slate-700 text-white"}`}>
                        TLP:{ioc.tlp.toUpperCase()}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {(ioc.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {expandedIOC === ioc.id ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0 ml-2" /> :
                   <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />}
                </div>

                {expandedIOC === ioc.id && (
                  <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500">IOC ID</span>
                      <p className="text-slate-300 mt-0.5">{ioc.id}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Source</span>
                      <p className="text-slate-300 mt-0.5">{ioc.source}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">First Seen</span>
                      <p className="text-slate-300 mt-0.5">{formatDate(ioc.first_seen)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Last Seen</span>
                      <p className="text-slate-300 mt-0.5">{formatDate(ioc.last_seen)}</p>
                    </div>
                    <div className="col-span-2 md:col-span-4">
                      <span className="text-slate-500">Tags</span>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {ioc.tags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-800 rounded text-slate-400 text-[10px]">{tag}</span>
                        ))}
                      </div>
                    </div>
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
