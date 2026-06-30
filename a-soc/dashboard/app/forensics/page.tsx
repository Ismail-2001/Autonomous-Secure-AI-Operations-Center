"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Terminal, Play, Square, Clock, CheckCircle, AlertTriangle,
  FileCode, Loader2, Shield, RefreshCw, ChevronDown, ChevronUp, Plus
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { api, ForensicsJob, ApiError } from "@/lib/api";
import { statusColor, formatDate } from "@/lib/utils";

const demoJobs: ForensicsJob[] = [
  {
    id: "fore-001", case_id: "CASE-2026-001", title: "Memory dump analysis - PROD-DB-01",
    status: "completed", job_type: "memory_analysis", target_evidence: "PROD-DB-01 RAM dump",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    completed_at: new Date().toISOString(),
    findings: ["Suspicious PowerShell process detected", "Injected DLL in svchost.exe", "C2 beacon pattern identified"],
    artifacts: ["memory_dump.raw", "extracted_processes.json", "network_connections.csv"],
  },
  {
    id: "fore-002", case_id: "CASE-2026-002", title: "Disk image analysis - SECOP-WKS-042",
    status: "running", job_type: "disk_analysis", target_evidence: "Full disk image WKS-042",
    created_at: new Date(Date.now() - 1800000).toISOString(),
    findings: ["Recovering deleted browser history"],
    artifacts: ["disk_image.E01"],
  },
  {
    id: "fore-003", case_id: "CASE-2026-003", title: "Network capture analysis - CORE-SW-01",
    status: "queued", job_type: "network_analysis", target_evidence: "PCAP from CORE-SW-01",
    created_at: new Date().toISOString(),
    findings: [],
    artifacts: [],
  },
];

export default function ForensicsLabPage() {
  const [jobs, setJobs] = useState<ForensicsJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getForensicsJobs({ status: statusFilter || undefined, limit: 50 });
      setJobs(data.jobs?.length ? data.jobs : demoJobs);
    } catch {
      setJobs(demoJobs);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const stats = {
    total: jobs.length,
    running: jobs.filter(j => j.status === "running").length,
    completed: jobs.filter(j => j.status === "completed").length,
    queued: jobs.filter(j => j.status === "queued").length,
  };

  return (
    <Shell>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Terminal className="w-6 h-6 text-cyan-400" />
              Forensics Lab
            </h1>
            <p className="text-slate-500 text-sm mt-1">Automated evidence collection, memory analysis, and disk forensics</p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchJobs} className="cyber-button flex items-center gap-2 text-sm !py-2 !px-4">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="cyber-card p-4 text-center">
            <p className="text-3xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">TOTAL JOBS</p>
          </div>
          <div className="cyber-card p-4 text-center border-cyan-500/30">
            <p className="text-3xl font-bold text-cyan-400">{stats.running}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">RUNNING</p>
          </div>
          <div className="cyber-card p-4 text-center border-emerald-500/30">
            <p className="text-3xl font-bold text-emerald-400">{stats.completed}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">COMPLETED</p>
          </div>
          <div className="cyber-card p-4 text-center border-slate-500/30">
            <p className="text-3xl font-bold text-slate-400">{stats.queued}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">QUEUED</p>
          </div>
        </div>

        <div className="flex gap-4">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none font-mono text-sm">
            <option value="">All Statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Shield className="w-8 h-8 text-cyan-500 animate-pulse" />
            <span className="ml-3 font-mono text-cyan-500 text-sm">Loading jobs...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="cyber-card p-5 cursor-pointer hover:border-slate-600 transition-colors"
                onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2 bg-slate-800 rounded-lg shrink-0">
                      {job.status === "running" ? <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" /> :
                       job.status === "completed" ? <CheckCircle className="w-5 h-5 text-emerald-400" /> :
                       job.status === "failed" ? <AlertTriangle className="w-5 h-5 text-red-400" /> :
                       <Clock className="w-5 h-5 text-slate-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium text-sm">{job.title}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-bold border ${statusColor(job.status)}`}>
                          {job.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs font-mono mt-0.5">
                        {job.case_id} &middot; {job.job_type.replace("_", " ")} &middot; {formatDate(job.created_at)}
                      </p>
                    </div>
                  </div>
                  {expandedJob === job.id ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> :
                   <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                </div>

                {expandedJob === job.id && (
                  <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-mono text-slate-500 uppercase mb-2">Findings ({job.findings.length})</h4>
                      {job.findings.length === 0 ? (
                        <p className="text-slate-600 text-xs italic">No findings yet</p>
                      ) : (
                        <ul className="space-y-1">
                          {job.findings.map((f, i) => (
                            <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                              <span className="text-cyan-400 mt-1 shrink-0">&#9656;</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-mono text-slate-500 uppercase mb-2">Artifacts ({job.artifacts.length})</h4>
                      {job.artifacts.length === 0 ? (
                        <p className="text-slate-600 text-xs italic">No artifacts collected</p>
                      ) : (
                        <ul className="space-y-1">
                          {job.artifacts.map((a, i) => (
                            <li key={i} className="text-sm text-slate-300 flex items-center gap-2">
                              <FileCode className="w-3 h-3 text-cyan-400 shrink-0" />
                              <span className="font-mono">{a}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <h4 className="text-xs font-mono text-slate-500 uppercase mb-2">Evidence Target</h4>
                      <p className="text-sm text-slate-300 font-mono">{job.target_evidence}</p>
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
