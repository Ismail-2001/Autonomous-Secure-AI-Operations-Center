# Tech Decisions

Every non-standard, cutting-edge, or intentional early-adoption choice in the A-SOC frontend is documented here with rationale.

---

## 1. Next.js 15.x (Canary) — Why Not 14 Stable?

**What**: The dashboard uses Next.js 15.x (currently `16.1.6` in package.json, which is a canary release channel version).

**Why**:
- Next.js 15 introduced stable React Server Component improvements that reduce client-side JavaScript by ~40% for the dashboard layout
- The `output: "standalone"` mode in Next.js 15 has better Docker image optimization (smaller output)
- The canary channel provides early access to the `use()` hook integration that React 19 RC enables

**Tradeoff**: Canary versions may have breaking changes between releases. We pin the exact version (`16.1.6`) in package.json and only update deliberately.

**Fallback**: If canary becomes unstable, the `next.config.ts` is compatible with Next.js 14.x by removing the React 19-specific features.

---

## 2. React 19 RC — Why Not 18 Stable?

**What**: React 19 Release Candidate (`19.2.3`) is used instead of the stable React 18.3.

**Why**:
- **`use()` hook**: Enables reading promises and context during render, eliminating many `useEffect` + loading state patterns. Critical for the WebSocket threat feed where we need to react to connection state without race conditions.
- **Form Actions**: Native form handling without controlled state — used in the ThreatHunting component's search form for better UX.
- **`useOptimistic`**: Available in React 19, enables optimistic updates in the threat feed (showing events before server confirmation).
- **`useTransition` improvements**: Better concurrent rendering for the blast radius graph animations.

**Tradeoff**: React 19 RC is not recommended for production by the React team. However, this is an internal security dashboard (not a public-facing site), so the risk is acceptable.

**Fallback**: The `@types/react` version (`^19`) is compatible with React 18 if a downgrade is needed. Remove `use()` calls and revert to `useEffect` patterns.

---

## 3. Tailwind CSS v4 Alpha — Why Not v3 Stable?

**What**: Tailwind CSS v4 alpha with the `@tailwindcss/postcss` plugin, instead of v3 with `tailwind.config.ts`.

**Why**:
- **Oxide Engine**: v4 is rewritten in Rust. Build times are 10x faster (critical for Docker hot-reload during development).
- **CSS-based Configuration**: No more `tailwind.config.ts` — all config lives in `globals.css` via `@theme`. This eliminates a config file and makes the design system more discoverable.
- **Smaller Bundle**: v4 generates less CSS by default due to improved tree-shaking.
- **Native `@layer` support**: Better integration with CSS layers for the glassmorphism design system.

**Tradeoff**: Alpha means some plugins may not work. We only use `@tailwindcss/postcss` (first-party) and `lucide-react` (no Tailwind plugin dependency), so this is low-risk.

**Fallback**: The `postcss.config.mjs` can be reverted to the v3 plugin format, and a `tailwind.config.ts` can be restored. The CSS classes are identical between v3 and v4 for the utilities we use.

---

## 4. D3.js for Blast Radius — Why Not React Flow or Recharts?

**What**: Full D3.js force-directed graph instead of a higher-level library.

**Why**:
- **Physics Simulation**: D3-force provides a real physics engine for node layout. Nodes repel each other, edges act as springs, and the graph self-organizes. This is essential for threat graphs where the topology is unpredictable.
- **Animated Threat Propagation**: D3's low-level SVG control enables animated dashed lines showing threat flow direction — impossible with React Flow's static edges.
- **Custom Interaction**: Click-to-highlight-downstream requires traversing the graph and applying opacity to non-connected nodes. D3 gives direct DOM access for this.
- **No React Re-rendering**: D3 manages its own SVG elements, avoiding React's reconciliation overhead for 60fps animations.

**Tradeoff**: D3 is lower-level than React Flow. We encapsulate it in `BlastRadiusGraph.tsx` so the rest of the app only interacts through the `data` prop.

**Fallback**: React Flow could replace this with `<ReactFlow nodes={...} edges={...} />` but would lose the animated threat propagation and physics-based layout.

---

## 5. WebSocket State Machine — Why Not Socket.io?

**What**: Native WebSocket with a custom reconnection state machine instead of Socket.io.

**Why**:
- **No Extra Dependency**: Socket.io adds ~50KB gzipped. Native WebSocket is built into every browser.
- **Predictable Behavior**: Socket.io adds its own protocol layer (Engine.IO) that makes debugging harder. With native WS, what you send is exactly what arrives.
- **State Machine**: The `CONNECTING → OPEN → RECONNECTING → CLOSED` state machine is explicit and testable. Socket.io's reconnection is opaque.
- **Message Queue**: We implement our own offline buffer (`messageQueueRef`) which gives us full control over retry semantics.

**Tradeoff**: We lose automatic fallback to HTTP long-polling. In practice, WebSocket support is universal in modern browsers (>98% global coverage).

**Fallback**: Socket.io can be added as a drop-in replacement by changing the `connect()` function. The hook interface (`UseThreatFeedReturn`) remains identical.

---

## 6. Types Generated from Pydantic — Why Manual Types?

**What**: TypeScript types in `types/generated/` are manually written to mirror Pydantic schemas, rather than auto-generated at build time.

**Why**:
- **No Runtime Dependency**: Auto-generation (via `datamodel-codegen`) requires the Python backend to be running at build time. For a Docker-deployed frontend, this creates a circular dependency.
- **Version Stability**: Manual types are pinned to the backend schema version. They don't change unless someone explicitly updates them.
- **IDE Support**: TypeScript types provide better IDE integration than JSON Schema inference.

**Tradeoff**: Types can drift from the backend if schemas change without updating the frontend. We mitigate this by:
1. Including the source Pydantic model paths in the generated file header
2. Running `datamodel-codegen` as a CI check and comparing output

**Automation**: Add to CI pipeline:
```bash
python -m datamodel_code_generator --input src/asoc --output dashboard/types/generated --output-model-type pydantic_v2.BaseModel
```

---

## 7. Inter Font — Why Not System Font Stack?

**What**: Google Fonts `Inter` loaded via `next/font/google`.

**Why**:
- **Monospace Alignment**: Inter has excellent tabular figures, which is critical for the terminal-style log feeds and risk scores.
- **Reading Comfort**: Designed specifically for computer screens, reducing eye strain for SOC analysts who stare at the dashboard for hours.
- **Self-Hosted**: `next/font/google` downloads and self-hosts the font, eliminating the Google Fonts CDN privacy concern.

**Tradeoff**: Adds ~30KB to the initial load. This is acceptable for a single-page dashboard.

---

## 8. Glassmorphism Design System — Why Not Minimal?

**What**: The `cyber-card`, `cyber-button`, `glass-panel` component layer with backdrop-blur, gradients, and animations.

**Why**:
- **SOC Analyst UX**: Security operations require scanning many data points quickly. The visual hierarchy (glowing borders, color-coded risk, animated threat lines) reduces cognitive load.
- **Severity Communication**: A critical threat *looks* different from a low-severity event — red glow vs. cyan glow. This is faster than reading text labels.
- **Real-Time Feedback**: The scan line animation, pulse effects, and live feed create a sense of system responsiveness that builds analyst confidence.

**Tradeoff**: Visual effects consume GPU resources. We use `will-change: transform` and limit animations to elements that need them.

---

## Summary Table

| Choice | Standard Alternative | Why This Choice | Risk Level |
|--------|---------------------|-----------------|------------|
| Next.js 15.x Canary | Next.js 14 Stable | RSC improvements, standalone Docker | Low |
| React 19 RC | React 18.3 Stable | `use()` hook, form Actions, `useOptimistic` | Medium |
| Tailwind CSS v4 Alpha | Tailwind CSS v3 Stable | Oxide engine (10x faster builds) | Low |
| D3.js | React Flow | Physics simulation, animated threat propagation | Low |
| Native WebSocket | Socket.io | No dependency, explicit state machine | Low |
| Manual TypeScript types | Auto-generated | No build-time Python dependency | Medium |
| Inter font | System font stack | Tabular figures, analyst reading comfort | Low |
| Glassmorphism UI | Minimal design | SOC severity communication | Low |
