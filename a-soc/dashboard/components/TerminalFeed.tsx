"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

export default function TerminalFeed({ title, events, color = "#1a73e8", maxHeight = 300, icon }: TerminalFeedProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [events.length]);

  return (
    <div className="terminal-block" style={{ height: maxHeight + 80 }}>
      <div className="terminal-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon || (
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
          )}
          <span style={{ color: "#374151" }}>{title}</span>
        </div>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "#9ca3af" }}>
          {events.length} events
        </span>
      </div>
      <div className="terminal-body" ref={bodyRef} style={{ maxHeight }}>
        {events.length === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: 12, padding: "12px 0", textAlign: "center" }}>
            Waiting for events...
          </div>
        ) : (
          <AnimatePresence>
            {events.map((evt) => (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="terminal-line"
              >
                <span className="terminal-timestamp">
                  {new Date(evt.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                </span>
                <span className="terminal-severity" style={{ color: severityColor(evt.severity) }}>
                  [{evt.severity.toUpperCase().padEnd(8)}]
                </span>
                <span className="terminal-source">{evt.source}</span>
                <span className="terminal-message">{evt.description}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
