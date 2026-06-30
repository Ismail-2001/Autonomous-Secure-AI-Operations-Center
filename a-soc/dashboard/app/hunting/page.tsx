"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Shield, AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Shell } from "@/components/Shell";
import { endpoints, ThreatEvent, ApiError } from "@/lib/api";
import { cn, severityBadge, formatDate } from "@/lib/utils";

export default function ThreatHuntingPage() {
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (query.trim()) {
        const data = await endpoints.searchEvents(query, severityFilter ? { severity: severityFilter } : undefined);
        setEvents(data.results || []);
      } else {
        const params: Record<string, string> = { limit: "50" };
        if (severityFilter) params.severity = severityFilter;
        const data = await endpoints.incidents(params);
        setEvents((data.incidents || []).map((inc) => ({
          id: inc.id, timestamp: inc.created_at, source: inc.source,
          event_type: inc.severity, severity: inc.severity,
          description: inc.description || inc.title, raw_data: inc as unknown as Record<string, unknown>,
        })));
      }
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Auth required" : "Backend may be starting up");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [query, severityFilter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return (
    <Shell title="Threat Hunting" subtitle="Search, filter, and investigate security events">
      <div className="p-6 space-y-5">
        {/* Search */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search threats, IPs, hashes, domains..."
              className="input pl-10"
              aria-label="Search threats"
            />
          </div>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="select w-40" aria-label="Severity filter">
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button onClick={fetchEvents} className="btn-primary">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Shield className="w-6 h-6 text-cyan-500 animate-pulse" />
            <span className="ml-2 font-mono text-cyan-500 text-sm">Searching...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center py-16 opacity-40">
            <Search className="w-12 h-12 text-slate-600" />
            <p className="text-slate-500 font-mono text-sm mt-3">No events found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="glass-card p-4 cursor-pointer hover:border-slate-600 transition-colors"
                onClick={() => setExpanded(expanded === event.id ? null : event.id)}
                role="button" tabIndex={0} aria-expanded={expanded === event.id}
                onKeyDown={(e) => e.key === "Enter" && setExpanded(expanded === event.id ? null : event.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={severityBadge(event.severity)}>{event.severity}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm truncate">{event.description}</p>
                      <p className="text-slate-500 text-xs font-mono mt-0.5">{event.source} · {formatDate(event.timestamp)}</p>
                    </div>
                  </div>
                  {expanded === event.id ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                </div>
                {expanded === event.id && (
                  <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                    <div><span className="text-slate-500">ID</span><p className="text-slate-300 mt-0.5">{event.id}</p></div>
                    <div><span className="text-slate-500">Type</span><p className="text-slate-300 mt-0.5">{event.event_type}</p></div>
                    <div><span className="text-slate-500">Time</span><p className="text-slate-300 mt-0.5">{formatDate(event.timestamp)}</p></div>
                    <div><span className="text-slate-500">Source</span><p className="text-slate-300 mt-0.5">{event.source}</p></div>
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
