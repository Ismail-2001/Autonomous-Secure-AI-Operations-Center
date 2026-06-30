"use client";

import { useState, useEffect, useCallback } from "react";
import { Terminal, Clock, CheckCircle, AlertTriangle, FileCode, Loader2, Shield, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Shell } from "@/components/Shell";
import { endpoints, ForensicsJob } from "@/lib/api";
import { statusBadge, formatDate, cn } from "@/lib/utils";

const demoJobs: ForensicsJob[] = [
  { id: "fore-001", case_id: "CASE-2026-001", title: "Memory dump analysis — PROD-DB-01", status: "completed", job_type: "memory_analysis", target_evidence: "PROD-DB-01 RAM dump", created_at: new Date(Date.now() - 3600000).toISOString(), completed_at: new Date().toISOString(), findings: ["Suspicious PowerShell process", "Injected DLL in svchost.exe", "C2 beacon pattern identified"], artifacts: ["memory_dump.raw", "extracted_processes.json", "network_connections.csv"] },
  { id: "fore-002", case_id: "CASE-2026-002", title: "Disk image analysis — SECOP-WKS-042", status: "running", job_type: "disk_analysis", target_evidence: "Full disk image WKS-042", created_at: new Date(Date.now() - 1800000).toISOString(), findings: ["Recovering deleted browser history"], artifacts: ["disk_image.E01"] },
  { id: "fore-003", case_id: "CASE-2026-003", title: "Network capture analysis — CORE-SW-01", status: "queued", job_type: "network_analysis", target_evidence: "PCAP from CORE-SW-01", created_at: new Date().toISOString(), findings: [], artifacts: [] },
];

export default function ForensicsLabPage() {
  const [jobs, setJobs] = useState<ForensicsJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await endpoints.forensics({ limit: "50" });
      setJobs(data.jobs?.length ? data.jobs : demoJobs);
    } catch { setJobs(demoJobs); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  return (
    <Shell title="Forensics Lab" subtitle="Evidence collection, memory analysis, and disk forensics">
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card p-3 text-center"><p className="text-2xl font-bold text-white">{jobs.length}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">TOTAL</p></div>
          <div className="glass-card p-3 text-center border-cyan-500/20"><p className="text-2xl font-bold text-cyan-400">{jobs.filter((j) => j.status === "running").length}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">RUNNING</p></div>
          <div className="glass-card p-3 text-center border-emerald-500/20"><p className="text-2xl font-bold text-emerald-400">{jobs.filter((j) => j.status === "completed").length}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">COMPLETED</p></div>
          <div className="glass-card p-3 text-center border-slate-500/20"><p className="text-2xl font-bold text-slate-400">{jobs.filter((j) => j.status === "queued").length}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">QUEUED</p></div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Shield className="w-6 h-6 text-cyan-500 animate-pulse" /></div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="glass-card p-4 cursor-pointer hover:border-slate-600 transition-colors"
                onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                role="button" tabIndex={0} aria-expanded={expanded === job.id}
                onKeyDown={(e) => e.key === "Enter" && setExpanded(expanded === job.id ? null : job.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-1.5 bg-slate-800 rounded-md shrink-0">
                      {job.status === "running" ? <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" /> :
                       job.status === "completed" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
                       job.status === "failed" ? <AlertTriangle className="w-4 h-4 text-red-400" /> :
                       <Clock className="w-4 h-4 text-slate-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium truncate">{job.title}</span>
                        <span className={statusBadge(job.status)}>{job.status}</span>
                      </div>
                      <p className="text-slate-500 text-xs font-mono mt-0.5">{job.case_id} · {job.job_type.replace("_", " ")} · {formatDate(job.created_at)}</p>
                    </div>
                  </div>
                  {expanded === job.id ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                </div>

                {expanded === job.id && (
                  <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[10px] font-mono text-slate-500 uppercase mb-1.5">Findings ({job.findings.length})</h4>
                      {job.findings.length === 0 ? <p className="text-slate-600 text-xs italic">No findings yet</p> :
                        <ul className="space-y-1">{job.findings.map((f, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5"><span className="text-cyan-400 mt-0.5">▸</span>{f}</li>
                        ))}</ul>}
                    </div>
                    <div>
                      <h4 className="text-[10px] font-mono text-slate-500 uppercase mb-1.5">Artifacts ({job.artifacts.length})</h4>
                      {job.artifacts.length === 0 ? <p className="text-slate-600 text-xs italic">No artifacts</p> :
                        <ul className="space-y-1">{job.artifacts.map((a, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-center gap-1.5"><FileCode className="w-3 h-3 text-cyan-400 shrink-0" /><span className="font-mono">{a}</span></li>
                        ))}</ul>}
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
