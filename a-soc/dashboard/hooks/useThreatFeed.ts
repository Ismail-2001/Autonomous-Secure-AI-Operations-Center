/**
 * Production-grade WebSocket hook for the A-SOC threat feed.
 *
 * Features:
 * - Exponential backoff reconnection (1s → 2s → 4s → ... → 30s cap)
 * - Message queue for offline buffering (replays on reconnect)
 * - Optimistic updates for low-latency UI feel
 * - Connection state machine: CONNECTING | OPEN | RECONNECTING | CLOSED
 * - Typed message handling (no `any` types)
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────

export type ConnectionState = "CONNECTING" | "OPEN" | "RECONNECTING" | "CLOSED";

export interface ThreatEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly agent: string;
  readonly status: string;
  readonly message: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly is_background?: boolean;
}

export interface ApprovalRequest {
  readonly type: "APPROVAL_REQUIRED";
  readonly action: string;
  readonly target: string;
  readonly risk_score: number;
}

export interface BlastRadiusUpdate {
  readonly type: "BLAST_RADIUS_UPDATE";
  readonly graph: GraphData;
  readonly root_cause: string;
}

export interface GraphNode {
  readonly id: string;
  readonly type: "threat_actor" | "identity" | "resource" | "unknown";
  readonly label: string;
  readonly risk: "critical" | "high" | "medium" | "low";
}

export interface GraphEdge {
  readonly source: string;
  readonly target: string;
  readonly label: string;
}

export interface GraphData {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export type WSMessage = ThreatEvent | ApprovalRequest | BlastRadiusUpdate;

export interface UseThreatFeedOptions {
  readonly url: string;
  readonly token: string;
  readonly maxReconnectAttempts?: number;
  readonly baseReconnectDelayMs?: number;
  readonly maxReconnectDelayMs?: number;
  readonly messageBufferSize?: number;
}

export interface UseThreatFeedReturn {
  readonly connectionState: ConnectionState;
  readonly events: readonly ThreatEvent[];
  readonly backgroundEvents: readonly ThreatEvent[];
  readonly approvalRequest: ApprovalRequest | null;
  readonly blastRadius: GraphData | null;
  readonly stats: FeedStats;
  readonly sendMessage: (message: string) => void;
  readonly startSimulation: () => void;
  readonly approveAction: () => void;
  readonly denyAction: () => void;
  readonly resetStats: () => void;
}

export interface FeedStats {
  readonly activeThreats: number;
  readonly resolved: number;
  readonly agentsActive: number;
  readonly totalEvents: number;
  readonly reconnectCount: number;
}

// ── State Machine ────────────────────────────────────────────────────────

type StateAction =
  | { type: "CONNECT" }
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "RECONNECT" }
  | { type: "GIVE_UP" };

function connectionReducer(state: ConnectionState, action: StateAction): ConnectionState {
  switch (action.type) {
    case "CONNECT":
      return "CONNECTING";
    case "OPEN":
      return "OPEN";
    case "CLOSE":
      return state === "OPEN" ? "RECONNECTING" : state;
    case "RECONNECT":
      return "RECONNECTING";
    case "GIVE_UP":
      return "CLOSED";
    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useThreatFeed(options: UseThreatFeedOptions): UseThreatFeedReturn {
  const {
    url,
    token,
    maxReconnectAttempts = 10,
    baseReconnectDelayMs = 1000,
    maxReconnectDelayMs = 30000,
    messageBufferSize = 100,
  } = options;

  const [connectionState, dispatch] = useReducer(connectionReducer, "CLOSED");
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [backgroundEvents, setBackgroundEvents] = useState<ThreatEvent[]>([]);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [blastRadius, setBlastRadius] = useState<GraphData | null>(null);
  const [stats, setStats] = useState<FeedStats>({
    activeThreats: 0,
    resolved: 0,
    agentsActive: 0,
    totalEvents: 0,
    reconnectCount: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageQueueRef = useRef<string[]>([]);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  const calculateDelay = useCallback(
    (attempt: number): number => {
      const delay = baseReconnectDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * delay;
      return Math.min(delay + jitter, maxReconnectDelayMs);
    },
    [baseReconnectDelayMs, maxReconnectDelayMs]
  );

  const processMessage = useCallback((data: WSMessage) => {
    if (!mountedRef.current) return;

    // Approval request — highest priority
    if ("type" in data && data.type === "APPROVAL_REQUIRED") {
      setApprovalRequest(data as ApprovalRequest);
      return;
    }

    // Blast radius update
    if ("type" in data && data.type === "BLAST_RADIUS_UPDATE") {
      setBlastRadius((data as BlastRadiusUpdate).graph);
      return;
    }

    // Threat event
    const event = data as ThreatEvent;
    if (event.agent) {
      if (event.is_background) {
        setBackgroundEvents((prev) => [event, ...prev].slice(0, messageBufferSize));
      } else {
        setEvents((prev) => [event, ...prev].slice(0, messageBufferSize));

        // Optimistic stats update
        if (event.severity === "high" || event.severity === "critical") {
          setStats((prev) => ({ ...prev, activeThreats: prev.activeThreats + 1 }));
        }
        if (event.status === "success" || event.status === "logged") {
          setStats((prev) => ({
            ...prev,
            resolved: prev.resolved + 1,
            activeThreats: Math.max(0, prev.activeThreats - 1),
          }));
        }
      }

      setStats((prev) => ({ ...prev, totalEvents: prev.totalEvents + 1 }));
    }
  }, [messageBufferSize]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
    }

    dispatch({ type: "CONNECT" });

    const ws = new WebSocket(`${url}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      dispatch({ type: "OPEN" });
      reconnectAttemptRef.current = 0;
      setStats((prev) => ({ ...prev, agentsActive: 6 }));

      // Flush offline message queue
      while (messageQueueRef.current.length > 0) {
        const queued = messageQueueRef.current.shift();
        if (queued && ws.readyState === WebSocket.OPEN) {
          ws.send(queued);
        }
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        processMessage(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      dispatch({ type: "CLOSE" });

      if (reconnectAttemptRef.current < maxReconnectAttempts) {
        const delay = calculateDelay(reconnectAttemptRef.current);
        reconnectAttemptRef.current += 1;

        setStats((prev) => ({
          ...prev,
          reconnectCount: prev.reconnectCount + 1,
          agentsActive: 0,
        }));

        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            dispatch({ type: "RECONNECT" });
            connect();
          }
        }, delay);
      } else {
        dispatch({ type: "GIVE_UP" });
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url, token, maxReconnectAttempts, calculateDelay, processMessage]);

  // Connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      // Queue for offline delivery
      messageQueueRef.current.push(message);
    }
  }, []);

  const startSimulation = useCallback(() => {
    sendMessage("START_SIMULATION");
    setEvents([]);
    setBackgroundEvents([]);
    setBlastRadius(null);
    setApprovalRequest(null);
  }, [sendMessage]);

  const approveAction = useCallback(() => {
    sendMessage("APPROVE_ACTION");
    setApprovalRequest(null);
  }, [sendMessage]);

  const denyAction = useCallback(() => {
    setApprovalRequest(null);
  }, []);

  const resetStats = useCallback(() => {
    setStats({
      activeThreats: 0,
      resolved: 0,
      agentsActive: 0,
      totalEvents: 0,
      reconnectCount: 0,
    });
    setEvents([]);
    setBackgroundEvents([]);
  }, []);

  return {
    connectionState,
    events,
    backgroundEvents,
    approvalRequest,
    blastRadius,
    stats,
    sendMessage,
    startSimulation,
    approveAction,
    denyAction,
    resetStats,
  };
}
