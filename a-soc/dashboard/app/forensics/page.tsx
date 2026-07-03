"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";

export default function ForensicsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [evidenceData, setEvidenceData] = useState<any[]>([]);

  useEffect(() => {
    import("@/lib/api").then(({ api, endpoints }) => {
      api.get(endpoints.forensics()).then((data: any) => {
        if (data?.jobs?.length) {
          setEvidenceData(data.jobs.map((j: any) => ({
            type: j.type?.toUpperCase() || "VOLATILE",
            name: j.artifacts?.[0] || `${j.id}.raw`,
            size: "16.0 GB",
            progress: j.status === "completed" ? 100 : j.status === "in_progress" ? 65 : 0,
            status: j.status?.toUpperCase() || "PENDING",
            borderColor: j.type === "volatile" ? "border-cyan-500" : j.type === "network" ? "border-blue-500" : "border-purple-500",
          })));
        }
      }).catch(() => {});
    });
  }, []);

  const evidenceCards = [
    {
      type: "VOLATILE",
      name: "MEM_DUMP_001.raw",
      size: "16.0 GB • Physical RAM",
      progress: 100,
      status: "INDEXED",
      statusColor: "text-cyan-400",
      sha256: "8F2A...",
      borderColor: "border-cyan-500",
      progressColor: "bg-cyan-500",
    },
    {
      type: "NETWORK",
      name: "TRAFFIC_SNIFF.pcap",
      size: "452 MB • Wireshark Capture",
      progress: 100,
      status: "DECRYPTED",
      statusColor: "text-cyan-400",
      sha256: "4C1B...",
      borderColor: "border-cyan-500",
      progressColor: "bg-cyan-500",
    },
    {
      type: "NON-VOLATILE",
      name: "SYSTEM_ROOT.e01",
      size: "500 GB • EnCase Image",
      progress: 65,
      status: "SCANNING...",
      statusColor: "text-red-400",
      sha256: "12E9...",
      borderColor: "border-red-500",
      progressColor: "bg-red-500",
    },
  ];

  const timelineEntries = [
    {
      time: "14:02:01.321",
      title: "KERNEL HOOK DETECTED",
      description:
        "System calls intercepted via LKM manipulation. Modification detected at memory address 0x7FFD4A2B.",
      hmacStatus: "VALID",
      hmacColor: "text-green-400",
      dotColor: "bg-cyan-500",
    },
    {
      time: "14:02:05.881",
      title: "PROCESS EXECUTION",
      description:
        'Execution of powershell.exe -enc ... initiated by parent process explorer.exe.',
      hmacStatus: "VALID",
      hmacColor: "text-green-400",
      dotColor: "bg-cyan-500",
    },
    {
      time: "14:03:12.110",
      title: "EXFILTRATION ATTEMPT",
      description:
        "Encrypted tunnel established to 192.168.10.42 (Target). Integrity seal...",
      hmacStatus: "MISSING",
      hmacColor: "text-red-400",
      dotColor: "bg-red-500",
    },
  ];

  const agents = [
    { name: "Telemetry Stream", icon: "📡", active: false },
    { name: "Threat Detection", icon: "🛡️", active: false },
    { name: "Supervisor Mode", icon: "👁️", active: false },
    { name: "Deep Forensics", icon: "🔬", active: true },
  ];

  const keyFindings = [
    { text: "Registry... (HKLM...)", success: true },
    { text: "Encryption... (C:\\Use...)", success: true },
    { text: "Original... network...", success: false },
  ];

  return (
    <Shell>
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center border border-cyan-500/30">
                <svg
                  className="w-6 h-6 text-cyan-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">Forensics Lab</h1>
              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-sm rounded-full border border-cyan-500/30">
                CASE: 2023-DELTA-9
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  id="forensics-search"
                  type="text"
                  placeholder="Search evidence logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search evidence logs"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <button className="px-4 py-2.5 border border-cyan-500 text-cyan-400 rounded-lg hover:bg-cyan-500/10 transition-colors font-medium">
                Ingest New Image
              </button>
            </div>
          </motion.div>

          {/* Evidence Catalog */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-400 tracking-wider">
                EVIDENCE CATALOG
              </h2>
              <p className="text-sm text-gray-500">
                Verified forensic acquisitions for Case Delta-9
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {evidenceCards.map((card, index) => (
                <motion.div
                  key={card.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + index * 0.05 }}
                  className={`bg-gray-900 border rounded-lg p-4`}
                  style={{ borderColor: `${card.borderColor}30` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded flex items-center justify-center ${
                          card.type === "VOLATILE"
                            ? "bg-purple-500/20"
                            : card.type === "NETWORK"
                            ? "bg-cyan-500/20"
                            : "bg-orange-500/20"
                        }`}
                      >
                        <span className="text-lg">
                          {card.type === "VOLATILE"
                            ? "⚡"
                            : card.type === "NETWORK"
                            ? "🌐"
                            : "💾"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 uppercase tracking-wider">
                        {card.type}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-sm font-medium text-white mb-1">
                    {card.name}
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">{card.size}</p>

                  <div className="mb-3">
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${card.progressColor} rounded-full`}
                        style={{ width: `${card.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${card.statusColor}`}>
                      STATUS: {card.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      SHA-256: {card.sha256}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Evidence Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 tracking-wider">
                Evidence Timeline
              </h2>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded-lg border border-green-500/30">
                  HMAC VERIFIED
                </button>
                <button className="p-1.5 text-gray-400 hover:text-white transition-colors">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-800" />

              <div className="space-y-6">
                {timelineEntries.map((entry, index) => (
                  <motion.div
                    key={entry.time}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="relative pl-8"
                  >
                    {/* Dot */}
                    <div
                      className={`absolute left-0 top-2 w-4 h-4 rounded-full ${entry.dotColor} border-2 border-gray-950`}
                    />

                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2 gap-3">
                        <span className="text-xs text-gray-500 font-mono whitespace-nowrap flex-shrink-0">
                          {entry.time}
                        </span>
                        <span
                          className={`text-xs font-medium flex-shrink-0 whitespace-nowrap ${
                            entry.hmacStatus === "VALID"
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          HMAC-SIGNATURE: {entry.hmacStatus}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white mb-2">
                        {entry.title}
                      </h4>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {entry.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="w-80 flex-shrink-0"
        >
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 sticky top-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider">
                AI AGENTS
              </h3>
              <p className="text-xs text-gray-500">Active Forensic Tasks</p>
            </div>

            <div className="mb-4">
              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full border border-cyan-500/30">
                AGENTS ONLINE: 04
              </span>
            </div>

            <div className="space-y-2 mb-6">
              {agents.map((agent) => (
                <div
                  key={agent.name}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    agent.active
                      ? "bg-cyan-500/10 border border-cyan-500/30"
                      : "bg-gray-800/50 border border-gray-700/50"
                  }`}
                >
                  <span className="text-lg">{agent.icon}</span>
                  <span
                    className={`text-sm ${
                      agent.active ? "text-cyan-400" : "text-gray-300"
                    }`}
                  >
                    {agent.name}
                  </span>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-400 tracking-wider mb-2">
                CURRENT HYPOTHESIS
              </h4>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Pending analysis...</p>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-400 tracking-wider mb-2">
                ANALYSIS
              </h4>
              <div className="space-y-2">
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-300">Artifact A...</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-300">Timeline I...</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-300">Payload Id...</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-400 tracking-wider mb-2">
                KEY FINDINGS
              </h4>
              <div className="space-y-2">
                {keyFindings.map((finding, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-xs text-gray-400"
                  >
                    {finding.success ? (
                      <span className="text-green-400 mt-0.5">✓</span>
                    ) : (
                      <span className="text-red-400 mt-0.5">✗</span>
                    )}
                    <span>{finding.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="w-full px-4 py-2.5 bg-cyan-500 text-gray-950 rounded-lg font-medium hover:bg-cyan-400 transition-colors">
              GENERATE...
            </button>
          </div>
        </motion.div>
      </div>
      </div>
    </Shell>
  );
}