"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Filter, AlertTriangle, Clock, Globe, Server,
  ChevronDown, ChevronUp, Download, RefreshCw, Shield
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { api, ThreatEvent, ApiError } from "@/lib/api";
import { severityColor, formatDate } from "@/lib/utils";

export default function ThreatHuntingPage() {
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (query.trim()) {
        const data = await api.searchEvents(query, severityFilter ? { severity: severityFilter } : undefined);
        setEvents(data.results || []);
      } else {
        const data = await api.getIncidents({ limit: 50, severity: severityFilter || undefined });
        setEvents((data.incidents || []).map((inc: any) => ({
          id: inc.id,
          timestamp: inc.created_at,
          source: inc.source,
          event_type: inc.severity,
          severity: inc.severity,
          description: inc.description || inc.title,
          raw_data: inc,
        })));
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Authentication required. Please refresh the page.");
      } else {
        setError("Failed to fetch events. Backend may be starting up.");
      }
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [query, severityFilter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents();
  };

  return (
    <Shell>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Search className="w-6 h-6 text-cyan-400" />
              Threat Hunting
            </h1>
            <p className="text-slate-500 text-sm mt-1">Search, filter, and investigate security events across all agents</p>
          </div>
          <button onClick={fetchEvents} className="cyber-button flex items-center gap-2 text-sm !py-2 !px-4">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search threats, IPs, hashes, domains..."
              className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 font-mono text-sm"
            />
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500/50 font-mono text-sm"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button type="submit" className="cyber-button flex items-center gap-2 text-sm !py-2 !px-6">
            <Search className="w-4 h-4" />
            Hunt
          </button>
        </form>

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Shield className="w-8 h-8 text-cyan-500 animate-pulse" />
            <span className="ml-3 font-mono text-cyan-500 text-sm">Searching...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-40">
            <Search className="w-16 h-16 text-slate-600" />
            <p className="text-slate-500 font-mono mt-4">No events found</p>
            <p className="text-slate-600 text-xs mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="cyber-card p-4 cursor-pointer hover:border-slate-600 transition-colors"
                onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-bold border ${severityColor(event.severity)}`}>
                      {event.severity.toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">{event.description}</p>
                      <p className="text-slate-500 text-xs font-mono mt-0.5">
                        {event.source} &middot; {formatDate(event.timestamp)}
                      </p>
                    </div>
                  </div>
                  {expandedEvent === event.id ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </div>
                {expandedEvent === event.id && (
                  <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500">Event ID</span>
                      <p className="text-slate-300 mt-0.5">{event.id}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Type</span>
                      <p className="text-slate-300 mt-0.5">{event.event_type}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Timestamp</span>
                      <p className="text-slate-300 mt-0.5">{formatDate(event.timestamp)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Source</span>
                      <p className="text-slate-300 mt-0.5">{event.source}</p>
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
