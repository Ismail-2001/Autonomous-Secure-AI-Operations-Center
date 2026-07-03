"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-[#0a0a0f] text-white font-mono">{children}</div>
);

interface Tag {
  label: string;
  color: string;
}

interface Asset {
  name: string;
  ip: string;
  riskScore: number;
  tags: Tag[];
  owner: string;
  os: string;
}

const assets: Asset[] = [
  {
    name: "SRV-PROD-DB-01",
    ip: "10.0.4.122",
    riskScore: 72,
    tags: [
      { label: "LOG4SHELL", color: "bg-red-500/20 text-red-400 border-red-500/30" },
      { label: "CVE-2023", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
      { label: "+3", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    ],
    owner: "SEC_OPS_A",
    os: "LINUX_DEBIAN",
  },
  {
    name: "K8S-NODE-04",
    ip: "10.0.12.89",
    riskScore: 12,
    tags: [
      { label: "HEALTHY", color: "bg-green-500/20 text-green-400 border-green-500/30" },
      { label: "ENCRYPTED", color: "bg-green-500/20 text-green-400 border-green-500/30" },
    ],
    owner: "INFRA_TEAM",
    os: "UBUNTU_22",
  },
  {
    name: "STATION-100",
    ip: "192.168.1.10",
    riskScore: 45,
    tags: [
      { label: "OUTDATED_OS", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    ],
    owner: "USER_ID_441",
    os: "MACOS_13",
  },
  {
    name: "STATION-101",
    ip: "192.168.1.11",
    riskScore: 46,
    tags: [
      { label: "OUTDATED_OS", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    ],
    owner: "USER_ID_442",
    os: "MACOS_13",
  },
  {
    name: "STATION-102",
    ip: "192.168.1.12",
    riskScore: 44,
    tags: [
      { label: "OUTDATED_OS", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    ],
    owner: "USER_ID_443",
    os: "MACOS_13",
  },
  {
    name: "STATION-103",
    ip: "192.168.1.13",
    riskScore: 47,
    tags: [
      { label: "OUTDATED_OS", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    ],
    owner: "USER_ID_444",
    os: "MACOS_13",
  },
  {
    name: "STATION-104",
    ip: "192.168.1.14",
    riskScore: 43,
    tags: [
      { label: "OUTDATED_OS", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    ],
    owner: "USER_ID_445",
    os: "MACOS_13",
  },
  {
    name: "STATION-105",
    ip: "192.168.1.15",
    riskScore: 48,
    tags: [
      { label: "OUTDATED_OS", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    ],
    owner: "USER_ID_446",
    os: "MACOS_13",
  },
];

const telemetryLogs = [
  { time: "14:02:01", tag: "CONN", msg: "INCOMING: 192.168.1.55:443 → LOCAL:60212" },
  { time: "14:01:58", tag: "AUTH", msg: "FAILED_LOGIN: root FROM 182.1.2.91" },
  { time: "14:01:44", tag: "SYS", msg: "KERNEL_UPDATE: COMPLETED_WITHOUT_REBOOT" },
  { time: "13:59:12", tag: "CONN", msg: "ESTABLISHED: DB_REPL_SERVICE" },
  { time: "13:58:20", tag: "WARN", msg: "DISK_USAGE: 88% ON /var/lib/docker" },
  { time: "13:55:01", tag: "INFO", msg: "HEARTBEAT_ACK: LATENCY 12ms" },
];

const riskColor = (score: number) => {
  if (score >= 60) return "text-red-400";
  if (score >= 30) return "text-orange-400";
  return "text-green-400";
};

const tagColorForTag = (label: string) => {
  if (label === "LOG4SHELL") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (label === "CVE-2023") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (label === "HEALTHY" || label === "ENCRYPTED") return "bg-green-500/20 text-green-400 border-green-500/30";
  if (label === "OUTDATED_OS") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  return "bg-gray-500/20 text-gray-400 border-gray-500/30";
};

export default function AssetsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(assets[0]);

  return (
    <Shell>
      <div className="flex h-screen overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TOP KPI CARDS */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Total Managed Assets */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-[#111118] border border-cyan-500/20 rounded-lg p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs tracking-wider">TOTAL_MANAGED_ASSETS</span>
                <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">14.2k</div>
              <div className="text-xs text-cyan-400 mb-3">+2.4% vs last scan</div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full" style={{ width: "78%" }} />
              </div>
            </motion.div>

            {/* Unmanaged Entities */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="bg-[#111118] border border-orange-500/20 rounded-lg p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs tracking-wider">UNMANAGED_ENTITIES</span>
                <div className="w-8 h-8 rounded bg-orange-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">82</div>
              <div className="text-xs text-orange-400 mb-3">New discovery required</div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: "34%" }} />
              </div>
            </motion.div>

            {/* Vulnerable Nodes */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-[#111118] border border-red-500/20 rounded-lg p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs tracking-wider">VULNERABLE_NODES</span>
                <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">312</div>
              <div className="text-xs text-red-400 mb-3">Critical patching req.</div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: "56%" }} />
              </div>
            </motion.div>
          </div>

          {/* FILTER BAR */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="bg-[#111118] border border-gray-800 rounded-lg p-4 mb-6 flex items-center gap-4"
          >
            <span className="text-cyan-400 font-bold text-sm tracking-wider mr-4">Inventory Matrix</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">OS:</span>
              <select className="bg-gray-800 border border-gray-700 text-white text-xs px-3 py-1.5 rounded focus:outline-none focus:border-cyan-500/50">
                <option>ALL_SYS</option>
                <option>LINUX_DEBIAN</option>
                <option>UBUNTU_22</option>
                <option>MACOS_13</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">LOC:</span>
              <select className="bg-gray-800 border border-gray-700 text-white text-xs px-3 py-1.5 rounded focus:outline-none focus:border-cyan-500/50">
                <option>GLOBAL</option>
                <option>US_EAST</option>
                <option>EU_WEST</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">RISK:</span>
              <select className="bg-gray-800 border border-gray-700 text-white text-xs px-3 py-1.5 rounded focus:outline-none focus:border-cyan-500/50">
                <option>CRITICAL_ONLY</option>
                <option>HIGH</option>
                <option>ALL</option>
              </select>
            </div>
            <button className="bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-bold px-4 py-1.5 rounded transition-colors ml-auto">
              APPLY_FILTERS
            </button>
          </motion.div>

          {/* ASSET GRID */}
          <div className="grid grid-cols-2 gap-4">
            {assets.map((asset, i) => (
              <motion.div
                key={asset.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.02 * i }}
                onClick={() => {
                  setSelectedAsset(asset);
                  setSidebarOpen(true);
                }}
                className="bg-[#111118] border border-gray-800 rounded-lg p-4 cursor-pointer hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-white tracking-wide">{asset.name}</span>
                      <span className={`text-lg font-bold ${riskColor(asset.riskScore)}`}>{asset.riskScore}</span>
                    </div>
                    <div className="text-gray-500 text-xs mb-2">{asset.ip}</div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {asset.tags.map((tag) => (
                        <span
                          key={tag.label}
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${tagColorForTag(tag.label)}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span>Owner: <span className="text-gray-300">{asset.owner}</span></span>
                      <span>OS: <span className="text-gray-300">{asset.os}</span></span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="w-[380px] border-l border-gray-800 bg-[#0e0e14] flex flex-col overflow-hidden flex-shrink-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-cyan-400 font-bold text-xs tracking-wider">ASSET INTELLIGENCE UNIT</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Selected Target */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-500 text-[10px] tracking-wider">SELECTED_TARGET</span>
                  <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="font-bold text-white text-sm mb-1">{selectedAsset.name}</div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-[10px]">UID:</span>
                  <span className="text-gray-400 text-[10px]">ASSET_9921_XG192</span>
                </div>
                <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded font-bold">
                  CRITICAL_RISK
                </span>
              </div>

              {/* Communication Topology */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-500 text-[10px] tracking-wider">COMMUNICATION TOPOLOGY</span>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded p-3 h-24 flex items-center justify-center">
                  <svg width="120" height="60" viewBox="0 0 120 60">
                    {/* Node 1 */}
                    <circle cx="20" cy="30" r="6" fill="#06b6d4" opacity="0.8" />
                    <text x="20" y="45" textAnchor="middle" fill="#6b7280" fontSize="6" fontFamily="monospace">A</text>
                    {/* Node 2 */}
                    <circle cx="60" cy="15" r="6" fill="#06b6d4" opacity="0.8" />
                    <text x="60" y="30" textAnchor="middle" fill="#6b7280" fontSize="6" fontFamily="monospace">B</text>
                    {/* Node 3 */}
                    <circle cx="100" cy="30" r="6" fill="#06b6d4" opacity="0.8" />
                    <text x="100" y="45" textAnchor="middle" fill="#6b7280" fontSize="6" fontFamily="monospace">C</text>
                    {/* Lines */}
                    <line x1="26" y1="27" x2="54" y2="17" stroke="#334155" strokeWidth="1" />
                    <line x1="66" y1="17" x2="94" y2="27" stroke="#334155" strokeWidth="1" />
                    <line x1="26" y1="33" x2="94" y2="33" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
                  </svg>
                </div>
              </div>

              {/* Telemetry Logs */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-500 text-[10px] tracking-wider">TELEMETRY_LOGS</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded font-bold">
                    LIVE_FEED
                  </span>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded p-3 space-y-2">
                  {telemetryLogs.map((log, i) => (
                    <div key={i} className="text-[10px] font-mono leading-relaxed">
                      <span className="text-gray-500">{log.time}</span>{" "}
                      <span className="text-cyan-400">[{log.tag}]</span>{" "}
                      <span className="text-gray-300">{log.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quarantine Button */}
            <div className="p-4 border-t border-gray-800">
              <button className="w-full bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-bold py-2.5 rounded transition-colors">
                INITIATE_QUARANTINE
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </Shell>
  );
}
