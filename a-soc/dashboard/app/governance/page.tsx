"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lock, Shield, CheckCircle, AlertTriangle, Clock, FileText,
  RefreshCw, BarChart3, ChevronDown, ChevronUp, ExternalLink
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { api, AuditEvent, ComplianceReport, ApiError } from "@/lib/api";
import { statusColor, formatDate } from "@/lib/utils";

const demoCompliance: ComplianceReport = {
  generated_at: new Date().toISOString(),
  score: 87,
  total_controls: 42,
  passed: 36,
  failed: 3,
  partial: 3,
  controls: [
    { id: "AC-1", name: "Access Control Policy", status: "pass", details: "RBAC + MFA enforced across all services" },
    { id: "AC-2", name: "Account Management", status: "pass", details: "Automated provisioning/deprovisioning via LDAP" },
    { id: "AC-3", name: "Access Enforcement", status: "pass", details: "JWT RS256 with role-based scopes" },
    { id: "AU-1", name: "Audit Policy", status: "pass", details: "HMAC chain-verified audit trail enabled" },
    { id: "AU-2", name: "Audit Events", status: "pass", details: "All 7 agents emit structured audit events" },
    { id: "AU-3", name: "Content of Audit Records", status: "partial", details: "Missing geolocation on some events" },
    { id: "AU-6", name: "Audit Review", status: "pass", details: "Supervisor agent reviews all audit events" },
    { id: "CA-1", name: "Certificate Policy", status: "pass", details: "RS256 asymmetric JWT with key rotation" },
    { id: "CM-1", name: "Configuration Management", status: "pass", details: "All configs in version control" },
    { id: "CM-3", name: "Configuration Change Control", status: "fail", details: "Missing automated change approval workflow" },
    { id: "IA-1", name: "Identification Policy", status: "pass", details: "Unique user IDs enforced" },
    { id: "IA-2", name: "Identification Mechanism", status: "pass", details: "JWT + fingerprint binding" },
    { id: "IR-1", name: "Incident Response Policy", status: "pass", details: "7-agent autonomous response pipeline" },
    { id: "IR-4", name: "Incident Handling", status: "partial", details: "Automated containment pending OPA approval" },
    { id: "IR-6", name: "Incident Reporting", status: "fail", details: "External SIEM integration not configured" },
    { id: "RA-1", name: "Risk Assessment Policy", status: "pass", details: "Per-agent risk scoring with OPA gates" },
    { id: "RA-5", name: "Vulnerability Scanning", status: "pass", details: "Automated scanning in DetectionAgent" },
    { id: "SC-1", name: "System Protection Policy", status: "pass", details: "Docker resource limits + network isolation" },
    { id: "SC-7", name: "Boundary Protection", status: "partial", details: "Rate limiting active, egress filtering TODO" },
    { id: "SC-8", name: "Transmission Confidentiality", status: "pass", details: "TLS enforced on all external endpoints" },
    { id: "SI-1", name: "System Information Integrity", status: "pass", details: "Checksum verification on all containers" },
    { id: "SI-2", name: "Flaw Remediation", status: "pass", details: "Automated patching pipeline" },
  ],
};

const demoAuditEvents: AuditEvent[] = [
  { id: "aud-001", timestamp: new Date(Date.now() - 300000).toISOString(), actor: "ResponseAgent", action: "BLOCK_IP", resource: "198.51.100.42", outcome: "success", details: { reason: "C2 indicator match", confidence: 0.92 }, hmac: "a1b2c3..." },
  { id: "aud-002", timestamp: new Date(Date.now() - 600000).toISOString(), actor: "SupervisorAgent", action: "APPROVE_ACTION", resource: "DetectionAgent.propose_response", outcome: "success", details: { risk_score: 0.78, reviewer: "auto" }, hmac: "d4e5f6..." },
  { id: "aud-003", timestamp: new Date(Date.now() - 900000).toISOString(), actor: "ComplianceAgent", action: "AUDIT_TRAIL_VERIFY", resource: "chain-integrity", outcome: "success", details: { entries_verified: 156, chain_valid: true }, hmac: "g7h8i9..." },
  { id: "aud-004", timestamp: new Date(Date.now() - 1200000).toISOString(), actor: "DetectionAgent", action: "ANOMALY_DETECTED", resource: "svc-redis-01", outcome: "success", details: { anomaly_type: "memory_spike", severity: "high" }, hmac: "j0k1l2..." },
  { id: "aud-005", timestamp: new Date(Date.now() - 1500000).toISOString(), actor: "NotificationAgent", action: "SEND_ALERT", resource: "slack-soc-channel", outcome: "success", details: { channel: "#soc-alerts", priority: "critical" }, hmac: "m3n4o5..." },
];

export default function GovernancePage() {
  const [compliance, setCompliance] = useState<ComplianceReport>(demoCompliance);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"compliance" | "audit">("compliance");
  const [expandedControl, setExpandedControl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [compData, auditData] = await Promise.allSettled([
        api.getComplianceReport(),
        api.getAuditEvents({ limit: 50 }),
      ]);
      if (compData.status === "fulfilled" && compData.value) setCompliance(compData.value);
      if (auditData.status === "fulfilled" && auditData.value?.events?.length) setAuditEvents(auditData.value.events);
      else setAuditEvents(demoAuditEvents);
    } catch {
      setAuditEvents(demoAuditEvents);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <Shell>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Lock className="w-6 h-6 text-cyan-400" />
              Governance & Compliance
            </h1>
            <p className="text-slate-500 text-sm mt-1">SOC 2 compliance controls, audit trail, and policy enforcement</p>
          </div>
          <button onClick={fetchData} className="cyber-button flex items-center gap-2 text-sm !py-2 !px-4">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="flex gap-4">
          <button onClick={() => setActiveTab("compliance")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "compliance" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-slate-500 hover:text-slate-300"}`}>
            <Shield className="w-4 h-4" /> Compliance Controls
          </button>
          <button onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "audit" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-slate-500 hover:text-slate-300"}`}>
            <FileText className="w-4 h-4" /> Audit Trail
          </button>
        </div>

        {activeTab === "compliance" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="cyber-card p-4 text-center md:col-span-1">
                <p className="text-4xl font-bold text-cyan-400">{compliance.score}%</p>
                <p className="text-xs text-slate-500 font-mono mt-1">COMPLIANCE SCORE</p>
              </div>
              <div className="cyber-card p-4 text-center">
                <p className="text-3xl font-bold text-white">{compliance.total_controls}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">TOTAL</p>
              </div>
              <div className="cyber-card p-4 text-center border-emerald-500/30">
                <p className="text-3xl font-bold text-emerald-400">{compliance.passed}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">PASSED</p>
              </div>
              <div className="cyber-card p-4 text-center border-yellow-500/30">
                <p className="text-3xl font-bold text-yellow-400">{compliance.partial}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">PARTIAL</p>
              </div>
              <div className="cyber-card p-4 text-center border-red-500/30">
                <p className="text-3xl font-bold text-red-400">{compliance.failed}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">FAILED</p>
              </div>
            </div>

            <div className="cyber-card p-2">
              <div className="w-full bg-slate-800 rounded-full h-3">
                <div className="flex h-full rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(compliance.passed / compliance.total_controls) * 100}%` }} />
                  <div className="bg-yellow-500 h-full transition-all" style={{ width: `${(compliance.partial / compliance.total_controls) * 100}%` }} />
                  <div className="bg-red-500 h-full transition-all" style={{ width: `${(compliance.failed / compliance.total_controls) * 100}%` }} />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Shield className="w-8 h-8 text-cyan-500 animate-pulse" />
              </div>
            ) : (
              <div className="space-y-2">
                {compliance.controls.map((ctrl) => (
                  <div key={ctrl.id} className="cyber-card p-4 cursor-pointer hover:border-slate-600 transition-colors"
                    onClick={() => setExpandedControl(expandedControl === ctrl.id ? null : ctrl.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {ctrl.status === "pass" ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" /> :
                         ctrl.status === "fail" ? <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" /> :
                         <Clock className="w-5 h-5 text-yellow-400 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 font-mono text-xs">{ctrl.id}</span>
                            <span className="text-white text-sm font-medium">{ctrl.name}</span>
                          </div>
                        </div>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-bold border ${statusColor(ctrl.status)}`}>
                          {ctrl.status.toUpperCase()}
                        </span>
                      </div>
                      {expandedControl === ctrl.id ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0 ml-2" /> :
                       <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 ml-2" />}
                    </div>
                    {expandedControl === ctrl.id && (
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <p className="text-slate-400 text-sm">{ctrl.details}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "audit" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="cyber-card p-4 text-center">
                <p className="text-3xl font-bold text-white">{auditEvents.length}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">AUDIT ENTRIES</p>
              </div>
              <div className="cyber-card p-4 text-center border-emerald-500/30">
                <p className="text-3xl font-bold text-emerald-400">{auditEvents.filter(e => e.outcome === "success").length}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">SUCCESS</p>
              </div>
              <div className="cyber-card p-4 text-center border-red-500/30">
                <p className="text-3xl font-bold text-red-400">{auditEvents.filter(e => e.outcome === "failure").length}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">FAILURES</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Shield className="w-8 h-8 text-cyan-500 animate-pulse" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">Time</th>
                      <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">Actor</th>
                      <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">Action</th>
                      <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">Resource</th>
                      <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">Outcome</th>
                      <th className="text-left py-3 px-4 text-slate-500 font-mono text-xs uppercase">HMAC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents.map((event) => (
                      <tr key={event.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono text-xs">{formatDate(event.timestamp)}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded text-xs font-mono">{event.actor}</span>
                        </td>
                        <td className="py-3 px-4 text-white font-mono text-xs">{event.action}</td>
                        <td className="py-3 px-4 text-slate-300 font-mono text-xs">{event.resource}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-bold border ${event.outcome === "success" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-red-400 bg-red-500/10 border-red-500/20"}`}>
                            {event.outcome.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-xs">{event.hmac}</td>
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
