"use client";

import { motion } from "framer-motion";

const PANEL_BG = "#0a0e1a";
const SKELETON_BG = "#1a1f2e";
const SHINE_COLOR = "#252b3b";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  style?: React.CSSProperties;
}

export function Skeleton({ width, height = 16, borderRadius = 4, style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: SKELETON_BG,
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      <motion.div
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(90deg, transparent, ${SHINE_COLOR}80, transparent)`,
        }}
      />
    </div>
  );
}

export function SkeletonCard({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "#0d1221",
        border: "1px solid #1e2a3a",
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...style,
      }}
    >
      <Skeleton width="40%" height={10} />
      <Skeleton width="70%" height={24} />
      <Skeleton width="100%" height={8} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div
      style={{
        background: "#0d1221",
        border: "1px solid #1e2a3a",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e2a3a", display: "flex", gap: 16 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={`${100 / cols}%`} height={10} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            padding: "12px 16px",
            borderBottom: r < rows - 1 ? "1px solid #1e2a3a20" : "none",
            display: "flex",
            gap: 16,
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={`${100 / cols}%`} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonAgent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Skeleton width="50%" height={12} />
        <Skeleton width="20%" height={12} />
      </div>
      <Skeleton width="100%" height={6} borderRadius={3} />
      <Skeleton width="80%" height={9} />
    </div>
  );
}

export function SkeletonKPI() {
  return (
    <div
      style={{
        background: "#0d1221",
        border: "1px solid #1e2a3a",
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <Skeleton width="60%" height={9} />
      <Skeleton width="40%" height={22} />
      <Skeleton width="80%" height={7} />
    </div>
  );
}

export function SkeletonTimeline({ items = 4 }: { items?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Skeleton width={8} height={8} borderRadius={4} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <Skeleton width="30%" height={9} />
            <Skeleton width="90%" height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}
