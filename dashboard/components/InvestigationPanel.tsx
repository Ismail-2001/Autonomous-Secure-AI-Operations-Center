"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, endpoints, type Incident, type ResponseAction } from "@/lib/api";
import type { UserRole } from "@/contexts/AuthContext";

const PANEL_BG = "#0a0e1a";
const CARD_BG = "#0d1221";
const PANEL_BORDER = "#1e2a3a";
const CYAN = "#00e5ff";
const RED = "#ff3d3d";
const ORANGE = "#ff9100";
const GREEN = "#22c55e";

const TRIAGE_STATUSES = [
  { value: "new", label: "NEW", color: "#64748b" },
  { value: "acknowledged", label: "ACKNOWLEDGED", color: "#3b82f6" },
  { value: "investigating", label: "INVESTIGATING", color: "#f59e0b" },
  { value: "escalated", label: "ESCALATED", color: "#ef4444" },
  { value: "contained", label: "CONTAINED", color: "#8b5cf6" },
  { value: "resolved", label: "RESOLVED", color: "#22c55e" },
  { value: "false_positive", label: "FALSE +", color: "#6b7280" },
] as const;

const ACTION_TYPES = [
  { value: "isolate", label: "ISOLATE", color: "#ef4444", icon: "🔒", minRole: "analyst" as const },
  { value: "block_ip", label: "BLOCK IP", color: "#f59e0b", icon: "🚫", minRole: "analyst" as const },
  { value: "disable_account", label: "DISABLE ACCT", color: "#f97316", icon: "👤", minRole: "supervisor" as const },
  { value: "quarantine", label: "QUARANTINE", color: "#8b5cf6", icon: "📦", minRole: "analyst" as const },
  { value: "snapshot", label: "SNAPSHOT", color: "#3b82f6", icon: "📸", minRole: "analyst" as const },
  { value: "escalate", label: "ESCALATE", color: "#ef4444", icon: "⬆️", minRole: "analyst" as const },
  { value: "notes", label: "ADD NOTES", color: "#64748b", icon: "📝", minRole: "readonly" as const },
] as const;

const ROLE_HIERARCHY: Record<UserRole, number> = {
  readonly: 0,
  analyst: 1,
  supervisor: 2,
  admin: 3,
};

function canPerform(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: RED,
  high: ORANGE,
  medium: "#eab308",
  low: "#64748b",
};

interface InvestigationPanelProps {
  incident: Incident | null;
  onClose: () => void;
  onUpdated: () => void;
  role?: UserRole;
}

export default function InvestigationPanel({ incident, onClose, onUpdated, role = "analyst" }: InvestigationPanelProps) {
  const [triageStatus, setTriageStatus] = useState(incident?.triage_status || "new");
  const [assignedTo, setAssignedTo] = useState(incident?.assigned_to || "");
  const [notes, setNotes] = useState(incident?.notes || "");
  const [actions, setActions] = useState<ResponseAction[]>([]);
  const [newActionType, setNewActionType] = useState("isolate");
  const [newActionDesc, setNewActionDesc] = useState("");
  const [newActionTarget, setNewActionTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionSaved, setActionSaved] = useState(false);
  const [actionsLoaded, setActionsLoaded] = useState(false);

  useEffect(() => {
    if (incident) {
      setTriageStatus(incident.triage_status || "new");
      setAssignedTo(incident.assigned_to || "");
      setNotes(incident.notes || "");
      setActionsLoaded(false);

      api.get<{ actions: ResponseAction[] }>(endpoints.triage.getActions(incident.id))
        .then((res) => {
          setActions(res.actions || []);
          setActionsLoaded(true);
        })
        .catch(() => {
          setActions(Array.isArray(incident.response_actions) ? incident.response_actions : []);
          setActionsLoaded(true);
        });
    }
  }, [incident]);

  if (!incident) return null;

  const severityColor = SEVERITY_COLORS[incident.severity] || "#64748b";
  const tags = Array.isArray(incident.tags)
    ? incident.tags
    : typeof incident.tags === "string"
    ? JSON.parse(incident.tags || "[]")
    : [];

  const canTriage = canPerform(role, "analyst");
  const canEscalate = canPerform(role, "supervisor");
  const canAdmin = canPerform(role, "admin");

  const handleTriageUpdate = async (newStatus: string) => {
    setSaving(true);
    try {
      await api.patch(endpoints.triage.update(incident.id), {
        triage_status: newStatus,
        assigned_to: assignedTo || undefined,
        notes: notes || undefined,
      });
      setTriageStatus(newStatus);
      onUpdated();
    } catch (e) {
      console.error("Triage update failed:", e);
    }
    setSaving(false);
  };

  const handleAddAction = async () => {
    if (!newActionDesc.trim()) return;
    setSaving(true);
    try {
      const result = await api.post<{ action: ResponseAction }>(endpoints.triage.addAction(incident.id), {
        action_type: newActionType,
        description: newActionDesc,
        target: newActionTarget || undefined,
      });
      setActions([result.action, ...actions]);
      setNewActionDesc("");
      setNewActionTarget("");
      setActionSaved(true);
      setTimeout(() => setActionSaved(false), 2000);
      onUpdated();
    } catch (e) {
      console.error("Add action failed:", e);
    }
    setSaving(false);
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await api.patch(endpoints.triage.update(incident.id), {
        triage_status: triageStatus,
        notes: notes,
      });
      onUpdated();
    } catch (e) {
      console.error("Save notes failed:", e);
    }
    setSaving(false);
  };

  const visibleTriageStatuses = canTriage
    ? TRIAGE_STATUSES
    : TRIAGE_STATUSES.filter((s) => s.value === triageStatus);

  const visibleActionTypes = ACTION_TYPES.filter((a) => canPerform(role, a.minRole));

  return (
    <AnimatePresence>
      {incident && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 90,
            }}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: 520,
              background: PANEL_BG,
              borderLeft: `1px solid ${PANEL_BORDER}`,
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${PANEL_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.1em", marginBottom: 4 }}>
                  {incident.incident_number || incident.id}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                  INVESTIGATION
                </div>
                <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>
                  Role: <span style={{ color: role === "admin" ? RED : role === "supervisor" ? ORANGE : CYAN }}>{role.toUpperCase()}</span>
                </div>
              </div>
              <button onClick={onClose} style={{ background: "none", border: `1px solid ${PANEL_BORDER}`, borderRadius: 6, padding: "6px 10px", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}>
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {/* Alert Info */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ background: `${severityColor}20`, color: severityColor, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em" }}>
                    {incident.severity?.toUpperCase()}
                  </span>
                  <span style={{ background: "#1e2a3a", color: "#94a3b8", padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>
                    {incident.source}
                  </span>
                  {incident.agent && (
                    <span style={{ background: `${CYAN}15`, color: CYAN, padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>
                      {incident.agent}
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", margin: "0 0 6px" }}>
                  {incident.title}
                </h3>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
                  {incident.description}
                </p>
                {tags.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                    {tags.map((tag: string, i: number) => (
                      <span key={i} style={{ background: "#1e2a3a", color: "#94a3b8", padding: "2px 6px", borderRadius: 3, fontSize: 9 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Triage Status */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: 8 }}>
                  TRIAGE STATUS {!canTriage && <span style={{ color: "#ef4444", fontSize: 8 }}>(READ ONLY)</span>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {visibleTriageStatuses.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => canTriage && handleTriageUpdate(s.value)}
                      disabled={!canTriage || saving}
                      style={{
                        background: triageStatus === s.value ? `${s.color}30` : "transparent",
                        border: `1px solid ${triageStatus === s.value ? s.color : PANEL_BORDER}`,
                        borderRadius: 4,
                        padding: "4px 10px",
                        color: triageStatus === s.value ? s.color : "#64748b",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        cursor: !canTriage ? "not-allowed" : saving ? "wait" : "pointer",
                        fontFamily: "inherit",
                        opacity: !canTriage ? 0.5 : 1,
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assign To */}
              {canEscalate && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: 8 }}>
                    ASSIGNED TO
                  </div>
                  <input
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    placeholder="analyst@asoc.local"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: CARD_BG,
                      border: `1px solid ${PANEL_BORDER}`,
                      borderRadius: 6,
                      color: "#e2e8f0",
                      fontSize: 12,
                      fontFamily: "inherit",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = CYAN)}
                    onBlur={(e) => (e.target.style.borderColor = PANEL_BORDER)}
                  />
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em" }}>
                    NOTES
                  </div>
                  <button
                    onClick={handleSaveNotes}
                    disabled={saving || role === "readonly"}
                    style={{
                      background: "none",
                      border: `1px solid ${CYAN}40`,
                      borderRadius: 4,
                      padding: "3px 8px",
                      color: role === "readonly" ? "#475569" : CYAN,
                      fontSize: 9,
                      cursor: saving || role === "readonly" ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {saving ? "SAVING..." : "SAVE"}
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={role === "readonly" ? "View only" : "Add investigation notes..."}
                  rows={3}
                  readOnly={role === "readonly"}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: CARD_BG,
                    border: `1px solid ${PANEL_BORDER}`,
                    borderRadius: 6,
                    color: "#e2e8f0",
                    fontSize: 12,
                    fontFamily: "inherit",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                    opacity: role === "readonly" ? 0.6 : 1,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = CYAN)}
                  onBlur={(e) => (e.target.style.borderColor = PANEL_BORDER)}
                />
              </div>

              {/* Response Actions */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: 8 }}>
                  RESPONSE ACTIONS
                </div>

                {/* Add new action — only for analyst+ */}
                {canTriage && (
                  <div style={{ background: CARD_BG, border: `1px solid ${PANEL_BORDER}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                      {visibleActionTypes.map((a) => (
                        <button
                          key={a.value}
                          onClick={() => setNewActionType(a.value)}
                          style={{
                            background: newActionType === a.value ? `${a.color}25` : "transparent",
                            border: `1px solid ${newActionType === a.value ? a.color : PANEL_BORDER}`,
                            borderRadius: 4,
                            padding: "3px 8px",
                            color: newActionType === a.value ? a.color : "#64748b",
                            fontSize: 9,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {a.icon} {a.label}
                        </button>
                      ))}
                    </div>
                    <input
                      value={newActionDesc}
                      onChange={(e) => setNewActionDesc(e.target.value)}
                      placeholder="Action description..."
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        background: PANEL_BG,
                        border: `1px solid ${PANEL_BORDER}`,
                        borderRadius: 4,
                        color: "#e2e8f0",
                        fontSize: 11,
                        fontFamily: "inherit",
                        outline: "none",
                        marginBottom: 6,
                        boxSizing: "border-box",
                      }}
                    />
                    <input
                      value={newActionTarget}
                      onChange={(e) => setNewActionTarget(e.target.value)}
                      placeholder="Target (IP, host, user...)"
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        background: PANEL_BG,
                        border: `1px solid ${PANEL_BORDER}`,
                        borderRadius: 4,
                        color: "#e2e8f0",
                        fontSize: 11,
                        fontFamily: "inherit",
                        outline: "none",
                        marginBottom: 8,
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      onClick={handleAddAction}
                      disabled={saving || !newActionDesc.trim()}
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: newActionDesc.trim() ? CYAN : `${CYAN}30`,
                        border: "none",
                        borderRadius: 4,
                        color: newActionDesc.trim() ? PANEL_BG : "#64748b",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: saving || !newActionDesc.trim() ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {actionSaved ? "✓ ACTION LOGGED" : saving ? "EXECUTING..." : "EXECUTE ACTION"}
                    </button>
                  </div>
                )}

                {/* Action history */}
                {actions.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {actions.map((a) => (
                      <div key={a.id} style={{ background: CARD_BG, border: `1px solid ${PANEL_BORDER}`, borderRadius: 6, padding: "8px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: CYAN }}>
                            {ACTION_TYPES.find((t) => t.value === a.type)?.icon} {a.type.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 9, color: "#64748b" }}>
                            {new Date(a.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{a.description}</div>
                        {a.target && (
                          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>Target: {a.target}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "#475569", textAlign: "center", padding: 16 }}>
                    No actions taken yet
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${PANEL_BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 9, color: "#475569" }}>
                Created: {new Date(incident.created_at).toLocaleString()}
              </div>
              <div style={{ fontSize: 9, color: "#475569" }}>
                {incident.risk_score != null && `Risk: ${Math.round(incident.risk_score * 100)}%`}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
