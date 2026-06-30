"use client";

import { useReducer, useCallback, useRef, useEffect } from "react";

type ConnectionState = "CLOSED" | "CONNECTING" | "OPEN" | "RECONNECTING";

interface ThreatEvent {
  id: string;
  timestamp: string;
  source: string;
  severity: string;
  description: string;
  type: "threat" | "background" | "approval" | "blast_radius";
}

interface BlastRadiusData {
  nodes: { id: string; label: string; type: string; risk: string }[];
  edges: { source: string; target: string; type: string }[];
}

interface ApprovalRequest {
  action: string;
  target: string;
  risk_score: number;
  run_id?: string;
}

interface FeedStats {
  activeThreats: number;
  resolved: number;
  agentsActive: number;
}

interface FeedState {
  connectionState: ConnectionState;
  events: ThreatEvent[];
  backgroundEvents: ThreatEvent[];
  approvalRequest: ApprovalRequest | null;
  blastRadius: BlastRadiusData | null;
  stats: FeedStats;
  reconnectAttempts: number;
}

type FeedAction =
  | { type: "CONNECTING" }
  | { type: "OPEN" }
  | { type: "CLOSED" }
  | { type: "RECONNECTING"; attempt: number }
  | { type: "ADD_EVENT"; event: ThreatEvent }
  | { type: "ADD_BACKGROUND"; event: ThreatEvent }
  | { type: "SET_APPROVAL"; request: ApprovalRequest | null }
  | { type: "SET_BLAST_RADIUS"; data: BlastRadiusData | null }
  | { type: "UPDATE_STATS"; stats: Partial<FeedStats> }
  | { type: "APPROVE" }
  | { type: "DENY" }
  | { type: "RESET" };

function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "CONNECTING":
      return { ...state, connectionState: "CONNECTING" };
    case "OPEN":
      return { ...state, connectionState: "OPEN", reconnectAttempts: 0 };
    case "CLOSED":
      return { ...state, connectionState: "CLOSED" };
    case "RECONNECTING":
      return { ...state, connectionState: "RECONNECTING", reconnectAttempts: action.attempt };
    case "ADD_EVENT":
      return { ...state, events: [action.event, ...state.events].slice(0, 100) };
    case "ADD_BACKGROUND":
      return { ...state, backgroundEvents: [action.event, ...state.backgroundEvents].slice(0, 50) };
    case "SET_APPROVAL":
      return { ...state, approvalRequest: action.request };
    case "SET_BLAST_RADIUS":
      return { ...state, blastRadius: action.data };
    case "UPDATE_STATS":
      return { ...state, stats: { ...state.stats, ...action.stats } };
    case "APPROVE":
      return { ...state, approvalRequest: null };
    case "DENY":
      return { ...state, approvalRequest: null };
    case "RESET":
      return { ...state, events: [], backgroundEvents: [], approvalRequest: null, blastRadius: null };
    default:
      return state;
  }
}

const initialState: FeedState = {
  connectionState: "CLOSED",
  events: [],
  backgroundEvents: [],
  approvalRequest: null,
  blastRadius: null,
  stats: { activeThreats: 0, resolved: 0, agentsActive: 0 },
  reconnectAttempts: 0,
};

interface UseThreatFeedOptions {
  url: string;
  token: string;
  maxReconnectAttempts?: number;
  baseReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export function useThreatFeed(options: UseThreatFeedOptions) {
  const {
    url,
    token,
    maxReconnectAttempts = 10,
    baseReconnectDelayMs = 1000,
    maxReconnectDelayMs = 30000,
  } = options;

  const [state, dispatch] = useReducer(feedReducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    dispatch({ type: "CONNECTING" });

    const ws = new WebSocket(`${url}/ws/threat-feed?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      dispatch({ type: "OPEN" });
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "APPROVAL_REQUIRED") {
          dispatch({ type: "SET_APPROVAL", request: msg.payload });
        } else if (msg.type === "BLAST_RADIUS_UPDATE") {
          dispatch({ type: "SET_BLAST_RADIUS", data: msg.payload });
        } else if (msg.type === "THREAT_EVENT" || msg.type === "INCIDENT") {
          const threatEvent: ThreatEvent = {
            id: msg.payload.id || crypto.randomUUID(),
            timestamp: msg.payload.timestamp || new Date().toISOString(),
            source: msg.payload.source || "unknown",
            severity: msg.payload.severity || "info",
            description: msg.payload.description || msg.payload.message || JSON.stringify(msg.payload),
            type: "threat",
          };
          dispatch({ type: "ADD_EVENT", event: threatEvent });
          dispatch({ type: "UPDATE_STATS", stats: { activeThreats: state.stats.activeThreats + 1 } });
        } else if (msg.type === "TELEMETRY" || msg.type === "HEARTBEAT") {
          const bgEvent: ThreatEvent = {
            id: msg.payload?.id || crypto.randomUUID(),
            timestamp: msg.timestamp || new Date().toISOString(),
            source: msg.payload?.source || "system",
            severity: msg.payload?.severity || "info",
            description: msg.payload?.message || msg.payload?.description || "System event",
            type: "background",
          };
          dispatch({ type: "ADD_BACKGROUND", event: bgEvent });
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      wsRef.current = null;

      const attempt = state.reconnectAttempts + 1;
      if (attempt >= maxReconnectAttempts) {
        dispatch({ type: "CLOSED" });
        return;
      }

      dispatch({ type: "RECONNECTING", attempt });
      const delay = Math.min(baseReconnectDelayMs * Math.pow(2, attempt - 1), maxReconnectDelayMs);

      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      /* onclose will handle reconnection */
    };
  }, [url, token, maxReconnectAttempts, baseReconnectDelayMs, maxReconnectDelayMs, state.reconnectAttempts, state.stats.activeThreats]);

  const disconnect = useCallback(() => {
    mountedRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    dispatch({ type: "CLOSED" });
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    }
  }, []);

  const startSimulation = useCallback(() => {
    sendMessage("START_SIMULATION");
  }, [sendMessage]);

  const approveAction = useCallback(() => {
    if (state.approvalRequest) {
      sendMessage(`APPROVE_ACTION:${JSON.stringify(state.approvalRequest)}`);
    }
    dispatch({ type: "APPROVE" });
  }, [sendMessage, state.approvalRequest]);

  const denyAction = useCallback(() => {
    if (state.approvalRequest) {
      sendMessage(`DENY_ACTION:${JSON.stringify(state.approvalRequest)}`);
    }
    dispatch({ type: "DENY" });
  }, [sendMessage, state.approvalRequest]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionState: state.connectionState,
    events: state.events,
    backgroundEvents: state.backgroundEvents,
    approvalRequest: state.approvalRequest,
    blastRadius: state.blastRadius,
    stats: state.stats,
    reconnectAttempts: state.reconnectAttempts,
    startSimulation,
    approveAction,
    denyAction,
    sendMessage,
  };
}

export type { ConnectionState, ThreatEvent, BlastRadiusData, ApprovalRequest, FeedStats };
