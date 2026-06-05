"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Filter, Calendar, Clock, AlertTriangle, Shield, Activity, ChevronDown, ChevronRight, Download, X } from "lucide-react";

interface HuntingEvent {
  id: string;
  timestamp: string;
  type: string;
  agent: string;
  payload: Record<string, unknown>;
  signature: string;
}

interface TimelineBucket {
  time: string;
  count: number;
}

export function ThreatHunting() {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [events, setEvents] = useState<HuntingEvent[]>([]);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [bucketSize, setBucketSize] = useState<"hour" | "day" | "minute">("hour");
  const [error, setError] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9002";

  const search = useCallback(async (offset = 0) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (sourceFilter) params.set("agent", sourceFilter);
      if (typeFilter) params.set("event_type", typeFilter);
      params.set("limit", "50");
      params.set("offset", offset.toString());

      const [eventsRes, timelineRes] = await Promise.all([
        fetch(`${API_BASE}/api/hunting/events?${params}`),
        fetch(`${API_BASE}/api/hunting/timeline?${params}&bucket=${bucketSize}`),
      ]);

      if (!eventsRes.ok) throw new Error(`Events API error: ${eventsRes.status}`);
      if (!timelineRes.ok) throw new Error(`Timeline API error: ${timelineRes.status}`);

      const eventsData = await eventsRes.json();
      const timelineData = await timelineRes.json();

      setEvents(eventsData.events || []);
      setTotal(eventsData.total || 0);
      setTimeline(timelineData.buckets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setEvents([]);
      setTimeline([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, sourceFilter, typeFilter, bucketSize, API_BASE]);

  useEffect(() => {
    search();
  }, [search]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString();
  };

  const maxCount = Math.max(1, ...timeline.map((b) => b.count));

  const getSeverityColor = (payload: Record<string, unknown>) => {
    const score = payload?.risk_score as number | undefined;
    if (!score) return "text-slate-400";
    if (score > 0.8) return "text-red-400";
    if (score > 0.6) return "text-orange-400";
    if (score > 0.3) return "text-yellow-400";
    return "text-emerald-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-6 h-6 text-cyan-400" />
            THREAT HUNTING
          </h2>
          <p className="text-slate-500 text-xs font-mono uppercase mt-1">
            Hunt for IOCs across all ingested security events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-slate-400 text-sm font-mono">
            {total} results
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, IPs, users, IOCs..."
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
          />
        </div>
        <select
          value={bucketSize}
          onChange={(e) => setBucketSize(e.target.value as "hour" | "day" | "minute")}
          className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="minute">Per Minute</option>
          <option value="hour">Per Hour</option>
          <option value="day">Per Day</option>
        </select>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="cyber-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">Source Agent</label>
              <input
                type="text"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                placeholder="e.g. DetectionAgent"
                className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1 uppercase">Event Type</label>
              <input
                type="text"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                placeholder="e.g. threat_detected"
                className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => { setSourceFilter(""); setTypeFilter(""); }}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="cyber-card border-red-500/30 bg-red-950/20 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Timeline Visualization */}
      {timeline.length > 0 && (
        <div className="cyber-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Event Timeline
            </h3>
            <span className="text-xs text-slate-500 font-mono">{timeline.length} buckets</span>
          </div>
          <div className="flex items-end gap-1 h-32 overflow-x-auto pb-2 no-scrollbar">
            {timeline.map((bucket) => (
              <div
                key={bucket.time}
                className="flex flex-col items-center flex-shrink-0"
                title={`${bucket.time}: ${bucket.count} events`}
              >
                <span className="text-[10px] text-slate-500 font-mono mb-1">{bucket.count}</span>
                <div
                  className="w-8 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                  style={{ height: `${Math.max(4, (bucket.count / maxCount) * 100)}px` }}
                />
                <span className="text-[8px] text-slate-600 font-mono mt-1 truncate w-12 text-center">
                  {bucket.time.includes("T") ? bucket.time.split("T")[1]?.substring(0, 5) || bucket.time.substring(5, 10) : bucket.time.substring(5, 10)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="cyber-card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Activity className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-600">
            <Search className="w-10 h-10 mb-3" />
            <p className="text-sm font-mono">No events match your criteria</p>
            <p className="text-xs text-slate-700 mt-1">Run a simulation or adjust filters</p>
          </div>
        ) : (
          <div>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 text-xs font-mono uppercase text-slate-500 bg-slate-900/50">
              <div className="col-span-3">Timestamp</div>
              <div className="col-span-2">Source</div>
              <div className="col-span-2">Event Type</div>
              <div className="col-span-1">Risk</div>
              <div className="col-span-4">Details</div>
            </div>

            {/* Table Rows */}
            {events.map((event) => (
              <div key={event.id}>
                <button
                  onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  className="w-full grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800/50 text-sm hover:bg-slate-800/30 transition-colors text-left"
                >
                  <div className="col-span-3 text-slate-300 font-mono text-xs flex items-center gap-2">
                    <Clock className="w-3 h-3 text-slate-600" />
                    {formatTime(event.timestamp)}
                  </div>
                  <div className="col-span-2 text-cyan-300 font-mono text-xs truncate">{event.agent}</div>
                  <div className="col-span-2 text-slate-300 font-mono text-xs truncate">{event.type}</div>
                  <div className={`col-span-1 font-mono text-xs ${getSeverityColor(event.payload)}`}>
                    {event.payload?.risk_score != null
                      ? `${(event.payload.risk_score as number * 100).toFixed(0)}%`
                      : "--"}
                  </div>
                  <div className="col-span-4 text-slate-400 text-xs truncate flex items-center gap-2">
                    {expandedId === event.id ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                    {event.payload?.reasoning as string || event.payload?.event_type as string || JSON.stringify(event.payload).substring(0, 60)}
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedId === event.id && (
                  <div className="px-6 py-4 bg-slate-900/30 border-b border-slate-800/50">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-mono uppercase text-slate-500 mb-2">Event Metadata</h4>
                        <div className="space-y-1.5 text-xs font-mono">
                          <div className="flex justify-between">
                            <span className="text-slate-500">ID</span>
                            <span className="text-slate-300">{event.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Agent</span>
                            <span className="text-cyan-300">{event.agent}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Type</span>
                            <span className="text-slate-300">{event.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Signature</span>
                            <span className="text-slate-400 truncate max-w-[200px]">{event.signature.substring(0, 16)}...</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-mono uppercase text-slate-500 mb-2">Payload</h4>
                        <pre className="text-[10px] text-slate-400 font-mono bg-slate-950/50 p-3 rounded-lg overflow-x-auto max-h-32">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {total > 50 && (
              <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Showing {events.length} of {total} events</span>
                <div className="flex gap-2">
                  <button className="px-3 py-1 rounded border border-slate-700 hover:bg-slate-800 transition-colors">
                    Previous
                  </button>
                  <button className="px-3 py-1 rounded border border-slate-700 hover:bg-slate-800 transition-colors">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Button */}
      {events.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `threat-hunting-${new Date().toISOString()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export Results
          </button>
        </div>
      )}
    </div>
  );
}
