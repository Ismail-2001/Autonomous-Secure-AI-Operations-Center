"use client";

import React, { useEffect, useRef } from "react";
import { severityColor } from "@/lib/utils";

export interface FeedEvent {
  id: string;
  timestamp: string;
  severity: string;
  source: string;
  description: string;
}

interface TerminalFeedProps {
  title: string;
  events: FeedEvent[];
  color?: string;
  maxHeight?: number;
  icon?: React.ReactNode;
}

export default function TerminalFeed({ title, events, color = "#06b6d4", maxHeight = 300, icon }: TerminalFeedProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [events.length]);

  return (
    <div className="terminal-block" style={{ height: maxHeight + 80 }}>
      <div className="terminal-header" style={{ borderColor: `${color}33` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon || (
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
          )}
          <span style={{ color }}>{title}</span>
        </div>
        <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#475569" }}>
          {events.length} events
        </span>
      </div>
      <div className="terminal-body" ref={bodyRef} style={{ maxHeight }}>
        {events.length === 0 ? (
          <div style={{ color: "#475569", fontSize: 12, padding: "12px 0", textAlign: "center" }}>
            Waiting for events...
          </div>
        ) : (
          events.map((evt) => (
            <div key={evt.id} className="terminal-line" style={{ animation: "fade-in 0.3s ease" }}>
              <span className="terminal-timestamp">
                {new Date(evt.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
              </span>
              <span className="terminal-severity" style={{ color: severityColor(evt.severity) }}>
                [{evt.severity.toUpperCase().padEnd(8)}]
              </span>
              <span className="terminal-source">{evt.source}</span>
              <span className="terminal-message">{evt.description}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
