"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, Shield, CheckCircle, AlertTriangle, Clock, FileText, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Shell } from "@/components/Shell";
import { endpoints, AuditEvent, ComplianceReport } from "@/lib/api";
import { statusBadge, formatDate, cn } from "@/lib/utils";

const demoCompliance: ComplianceReport = {
  generated_at: new Date().toISOString(), score: 87, total_controls: 42, passed: 36, failed: 3, partial: 3,
  controls: [
    { id: "AC-1", name: "Access Control Policy", status: "pass", details: "RBAC + MFA enforced" },
    { id: "AC-2", name: "Account Management", status: "pass", details: "Automated provisioning via LDAP" },
    { id: "AC-3", name: "Access Enforcement", status: "pass", details: "JWT RS256 role-based scopes" },
    { id: "AU-1", name: "Audit Policy", status: "pass", details: "HMAC chain-verified audit trail" },
    { id: "AU-2", name: "Audit Events", status: "pass", details: "All 7 agents emit structured events" },
    { id: "AU-3", name: "Audit Record Content", status: "partial", details: "Missing geolocation on some events" },
    { id: "CM-3", name: "Change Control", status: "fail", details: "Missing automated approval workflow" },
    { id: "IR-4", name: "Incident Handling", status: "partial", details: "Automated containment pending OPA approval" },
    { id: "IR-6", name: "Incident Reporting", status: "fail", details: "External SIEM integration not configured" },
    { id: "SC-7", name: "Boundary Protection", status: "partial", details: "Rate limiting active, egress filtering TODO" },
  ],
};

const demoAudit: AuditEvent[] = [
  { id: "aud-001", timestamp: new Date(Date.now() - 300000).toISOString(), actor: "ResponseAgent", action: "BLOCK_IP", resource: "198.51.100.42", outcome: "success", details: {}, hmac: "a1b2c3..." },
  { id: "aud-002", timestamp: new Date(Date.now() - 600000).toISOString(), actor: "SupervisorAgent", action: "APPROVE_ACTION", resource: "DetectionAgent.propose_response", outcome: "success", details: {}, hmac: "d4e5f6..." },
  { id: "aud-003", timestamp: new Date(Date.now() - 900000).toISOString(), actor: "ComplianceAgent", action: "AUDIT_TRAIL_VERIFY", resource: "chain-integrity", outcome: "success", details: {}, hmac: "g7h8i9..." },
  { id: "aud-004", timestamp: new Date(Date.now() - 1200000).toISOString(), actor: "DetectionAgent", action: "ANOMALY_DETECTED", resource: "svc-redis-01", outcome: "success", details: {}, hmac: "j0k1l2..." },
  { id: "aud-005", timestamp: new Date(Date.now() - 1500000).toISOString(), actor: "NotificationAgent", action: "SEND_ALERT", resource: "slack-soc-channel", outcome: "success", details: {}, hmac: "m3n4o5..." },
];

export default function GovernancePage() {
  const [compliance, setCompliance] = useState<ComplianceReport>(demoCompliance);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"compliance" | "audit">("compliance");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, a] = await Promise.allSettled([endpoints.compliance(), endpoints.audit({ limit: "50" })]);
      if (c.status === "fulfilled" && c.value) setCompliance(c.value);
      if (a.status === "fulfilled" && a.value?.events?.length) setAuditEvents(a.value.events);
      else setAuditEvents(demoAudit);
    } catch { setAuditEvents(demoAudit); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <Shell title="Governance & Compliance" subtitle="SOC 2 compliance controls and audit trail">
      <div className="p-6 space-y-5">
        <div className="tab-group w-fit">
          <button onClick={() => setTab("compliance")} className={cn("tab-btn", tab === "compliance" && "active")}>
            <Shield className="w-3.5 h-3.5" /> Compliance
          </button>
          <button onClick={() => setTab("audit")} className={cn("tab-btn", tab === "audit" && "active")}>
            <FileText className="w-3.5 h-3.5" /> Audit Trail
          </button>
        </div>

        {tab === "compliance" && (
          <>
            <div className="grid grid-cols-5 gap-4">
              <div className="glass-card p-3 text-center"><p className="text-3xl font-bold text-cyan-400">{compliance.score}%</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">SCORE</p></div>
              <div className="glass-card p-3 text-center"><p className="text-2xl font-bold text-white">{compliance.total_controls}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">TOTAL</p></div>
              <div className="glass-card card-success p-3 text-center"><p className="text-2xl font-bold text-emerald-400">{compliance.passed}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">PASSED</p></div>
              <div className="glass-card card-warning p-3 text-center"><p className="text-2xl font-bold text-yellow-400">{compliance.partial}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">PARTIAL</p></div>
              <div className="glass-card card-critical p-3 text-center"><p className="text-2xl font-bold text-red-400">{compliance.failed}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">FAILED</p></div>
            </div>

            <div className="glass-card p-2">
              <div className="progress-bar">
                <div className="flex h-full rounded-full overflow-hidden">
                  <div className="progress-success transition-all" style={{ width: `${(compliance.passed / compliance.total_controls) * 100}%` }} />
                  <div className="progress-medium transition-all" style={{ width: `${(compliance.partial / compliance.total_controls) * 100}%` }} />
                  <div className="progress-critical transition-all" style={{ width: `${(compliance.failed / compliance.total_controls) * 100}%` }} />
                </div>
              </div>
            </div>

            {loading ? <div className="flex justify-center py-16"><Shield className="w-6 h-6 text-cyan-500 animate-pulse" /></div> : (
              <div className="space-y-1.5">
                {compliance.controls.map((ctrl) => (
                  <div key={ctrl.id} className="glass-card p-3 cursor-pointer hover:border-slate-600 transition-colors"
                    onClick={() => setExpanded(expanded === ctrl.id ? null : ctrl.id)}
                    role="button" tabIndex={0} aria-expanded={expanded === ctrl.id}
                    onKeyDown={(e) => e.key === "Enter" && setExpanded(expanded === ctrl.id ? null : ctrl.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {ctrl.status === "pass" ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> :
                         ctrl.status === "fail" ? <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" /> :
                         <Clock className="w-4 h-4 text-yellow-400 shrink-0" />}
                        <span className="text-slate-400 font-mono text-xs">{ctrl.id}</span>
                        <span className="text-white text-sm truncate">{ctrl.name}</span>
                      </div>
                      <span className={statusBadge(ctrl.status)}>{ctrl.status}</span>
                    </div>
                    {expanded === ctrl.id && (
                      <div className="mt-2 pt-2 border-t border-slate-800"><p className="text-slate-400 text-sm">{ctrl.details}</p></div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "audit" && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="glass-card p-3 text-center"><p className="text-2xl font-bold text-white">{auditEvents.length}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">ENTRIES</p></div>
              <div className="glass-card card-success p-3 text-center"><p className="text-2xl font-bold text-emerald-400">{auditEvents.filter((e) => e.outcome === "success").length}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">SUCCESS</p></div>
              <div className="glass-card card-critical p-3 text-center"><p className="text-2xl font-bold text-red-400">{auditEvents.filter((e) => e.outcome === "failure").length}</p><p className="text-[10px] text-slate-500 font-mono mt-0.5">FAILURES</p></div>
            </div>

            {loading ? <div className="flex justify-center py-16"><Shield className="w-6 h-6 text-cyan-500 animate-pulse" /></div> : (
              <div className="glass-card overflow-hidden">
                <table className="data-table">
                  <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Outcome</th><th>HMAC</th></tr></thead>
                  <tbody>
                    {auditEvents.map((event) => (
                      <tr key={event.id}>
                        <td className="font-mono text-xs">{formatDate(event.timestamp)}</td>
                        <td><span className="badge badge-info">{event.actor}</span></td>
                        <td className="font-mono text-xs text-white">{event.action}</td>
                        <td className="font-mono text-xs">{event.resource}</td>
                        <td><span className={cn("badge", event.outcome === "success" ? "badge-success" : "badge-critical")}>{event.outcome}</span></td>
                        <td className="font-mono text-xs text-slate-600">{event.hmac}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
