"use client";

import { useReducer, useEffect, useCallback, useRef, useState } from "react";
import { config } from "@/lib/config";
import { useAuth } from "@/contexts/AuthContext";

export interface ThreatFeedEvent {
  id: string;
  timestamp: string;
  severity: string;
  source: string;
  type: string;
  description: string;
  agent?: string;
  confidence?: number;
  mitigated?: boolean;
  raw?: unknown;
}

export interface ApprovalRequest {
  id: string;
  action: string;
  target: string;
  risk_score: number;
  reasoning?: string;
  timestamp: string;
  agent?: string;
}

export interface BlastRadiusNode {
  id: string;
  label: string;
  risk: number;
  type: string;
}

export interface BlastRadiusEdge {
  source: string;
  target: string;
}

interface FeedState {
  connectionState: "CLOSED" | "CONNECTING" | "OPEN" | "RECONNECTING";
  events: ThreatFeedEvent[];
  backgroundEvents: ThreatFeedEvent[];
  approvalRequest: ApprovalRequest | null;
  blastRadius: { nodes: BlastRadiusNode[]; edges: BlastRadiusEdge[] };
  stats: { threats: number; neutralized: number; mttr: number; agents: number };
  reconnectAttempts: number;
}

type FeedAction =
  | { type: "SET_STATE"; payload: Partial<FeedState> }
  | { type: "ADD_EVENT"; payload: ThreatFeedEvent }
  | { type: "ADD_BACKGROUND"; payload: ThreatFeedEvent }
  | { type: "SET_APPROVAL"; payload: ApprovalRequest | null }
  | { type: "SET_BLAST_RADIUS"; payload: { nodes: BlastRadiusNode[]; edges: BlastRadiusEdge[] } }
  | { type: "SET_STATS"; payload: FeedState["stats"] };

const initialState: FeedState = {
  connectionState: "CLOSED",
  events: [],
  backgroundEvents: [],
  approvalRequest: null,
  blastRadius: { nodes: [], edges: [] },
  stats: { threats: 0, neutralized: 0, mttr: 0, agents: 7 },
  reconnectAttempts: 0,
};

function reducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "SET_STATE":
      return { ...state, ...action.payload };
    case "ADD_EVENT":
      return {
        ...state,
        events: [action.payload, ...state.events].slice(0, config.display.maxEvents),
      };
    case "ADD_BACKGROUND":
      return {
        ...state,
        backgroundEvents: [action.payload, ...state.backgroundEvents].slice(0, config.display.maxBackgroundEvents),
      };
    case "SET_APPROVAL":
      return { ...state, approvalRequest: action.payload };
    case "SET_BLAST_RADIUS":
      return { ...state, blastRadius: action.payload };
    case "SET_STATS":
      return { ...state, stats: action.payload };
    default:
      return state;
  }
}

export function useThreatFeed() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { token } = useAuth();
  const [simulating, setSimulating] = useState(false);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    dispatch({ type: "SET_STATE", payload: { connectionState: "CONNECTING" } });

    try {
      const url = `${config.ws.url}?token=${token || config.ws.token}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        dispatch({ type: "SET_STATE", payload: { connectionState: "OPEN", reconnectAttempts: 0 } });
      };

      ws.onmessage = (ev) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(ev.data);
          const eventType = msg.type || msg.event;

          switch (eventType) {
            case "THREAT_EVENT":
            case "INCIDENT": {
              const event: ThreatFeedEvent = {
                id: msg.id || msg.data?.id || `evt-${Date.now()}`,
                timestamp: msg.timestamp || msg.data?.timestamp || new Date().toISOString(),
                severity: msg.severity || msg.data?.severity || "info",
                source: msg.source || msg.data?.source || "unknown",
                type: msg.threat_type || msg.data?.threat_type || eventType,
                description: msg.description || msg.data?.description || "",
                agent: msg.agent || msg.data?.agent,
                confidence: msg.confidence || msg.data?.confidence,
                mitigated: msg.mitigated || msg.data?.mitigated || false,
                raw: msg,
              };
              dispatch({ type: "ADD_EVENT", payload: event });
              break;
            }
            case "TELEMETRY": {
              const tel: ThreatFeedEvent = {
                id: `tel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                timestamp: msg.timestamp || new Date().toISOString(),
                severity: "info",
                source: msg.source || "telemetry",
                type: "TELEMETRY",
                description: msg.message || msg.description || JSON.stringify(msg.data || {}),
                raw: msg,
              };
              dispatch({ type: "ADD_BACKGROUND", payload: tel });
              break;
            }
            case "APPROVAL_REQUIRED": {
              dispatch({
                type: "SET_APPROVAL",
                payload: {
                  id: msg.id || msg.data?.id || `apr-${Date.now()}`,
                  action: msg.action || msg.data?.action || "unknown",
                  target: msg.target || msg.data?.target || "unknown",
                  risk_score: msg.risk_score || msg.data?.risk_score || 0,
                  reasoning: msg.reasoning || msg.data?.reasoning,
                  timestamp: msg.timestamp || new Date().toISOString(),
                  agent: msg.agent || msg.data?.agent,
                },
              });
              break;
            }
            case "BLAST_RADIUS_UPDATE": {
              if (msg.data) {
                dispatch({ type: "SET_BLAST_RADIUS", payload: msg.data });
              }
              break;
            }
            case "STATS_UPDATE": {
              if (msg.data) {
                dispatch({ type: "SET_STATS", payload: msg.data });
              }
              break;
            }
            case "HEARTBEAT":
              break;
          }
        } catch (_e) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        const attempts = state.reconnectAttempts + 1;

        if (attempts < config.ws.maxReconnect) {
          dispatch({ type: "SET_STATE", payload: { connectionState: "RECONNECTING", reconnectAttempts: attempts } });
          const delay = Math.min(config.ws.baseDelayMs * Math.pow(2, attempts), config.ws.maxDelayMs);
          reconnectTimer.current = setTimeout(connect, delay);
        } else {
          dispatch({ type: "SET_STATE", payload: { connectionState: "CLOSED" } });
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (_e) {
      dispatch({ type: "SET_STATE", payload: { connectionState: "CLOSED" } });
    }
  }, [token, state.reconnectAttempts]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const startSimulation = useCallback(() => {
    setSimulating(true);
    sendMessage({ type: "START_SIMULATION" });
  }, [sendMessage]);

  const approveAction = useCallback((id: string) => {
    sendMessage({ type: "APPROVE_ACTION", id });
    dispatch({ type: "SET_APPROVAL", payload: null });
  }, [sendMessage]);

  const denyAction = useCallback((id: string) => {
    sendMessage({ type: "DENY_ACTION", id });
    dispatch({ type: "SET_APPROVAL", payload: null });
  }, [sendMessage]);

  return {
    ...state,
    simulating,
    startSimulation,
    approveAction,
    denyAction,
    sendMessage,
  };
}
