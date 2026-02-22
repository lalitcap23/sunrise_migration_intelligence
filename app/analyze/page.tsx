"use client";

import { useState } from "react";
import Link from "next/link";

const CHAINS = [
  { id: "ethereum", label: "Ethereum" },
  { id: "bsc", label: "BNB Chain" },
  { id: "polygon", label: "Polygon" },
];

const MODULES = [
  { id: "demand",    label: "Market Demand Score" },
  { id: "holders",   label: "Holder Distribution" },
  { id: "liquidity", label: "Liquidity Profile" },
  { id: "bridges",   label: "Cross-Chain Bridge Risk" },
  { id: "strategy",  label: "Migration Strategy" },
  { id: "score",     label: "Overall Readiness Score" },
];

type Status = "idle" | "loading" | "done";

export default function AnalyzePage() {
  const [token, setToken]   = useState("");
  const [chain, setChain]   = useState("ethereum");
  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, Status>>(
    Object.fromEntries(MODULES.map((m) => [m.id, "idle"]))
  );
  const [error, setError] = useState("");

  const allDone = MODULES.every((m) => statuses[m.id] === "done");

  async function handleRun() {
    if (!token.startsWith("0x") || token.length !== 42) {
      setError("Enter a valid contract address (0x… 42 chars).");
      return;
    }
    setError("");
    setRunning(true);
    setStatuses(Object.fromEntries(MODULES.map((m) => [m.id, "idle"])));

    for (const mod of MODULES) {
      setStatuses((prev) => ({ ...prev, [mod.id]: "loading" }));
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));
      setStatuses((prev) => ({ ...prev, [mod.id]: "done" }));
    }

    setRunning(false);
  }

  function handleReset() {
    setToken("");
    setChain("ethereum");
    setError("");
    setStatuses(Object.fromEntries(MODULES.map((m) => [m.id, "idle"])));
  }

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: "0 20px", fontFamily: "sans-serif" }}>

      {/* Back link */}
      <Link href="/" style={{ fontSize: 13, color: "#888", textDecoration: "none" }}>
        ← Back to home
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 20, marginBottom: 4 }}>
        Analyze a Token
      </h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
        Enter a contract address and pick the source chain to run the migration readiness check.
      </p>

      {/* Token address */}
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#444" }}>
        Token Contract Address
      </label>
      <input
        type="text"
        value={token}
        onChange={(e) => { setToken(e.target.value); setError(""); }}
        placeholder="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        disabled={running}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "10px 12px", fontSize: 13,
          fontFamily: "monospace", border: "1px solid #ccc",
          borderRadius: 6, outline: "none",
          background: running ? "#f5f5f5" : "#fff",
        }}
      />
      {error && (
        <p style={{ fontSize: 12, color: "#c00", marginTop: 4 }}>{error}</p>
      )}

      {/* Chain selector */}
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 6, color: "#444" }}>
        Source Chain
      </label>
      <select
        value={chain}
        onChange={(e) => setChain(e.target.value)}
        disabled={running}
        style={{
          width: "100%", padding: "10px 12px",
          fontSize: 13, border: "1px solid #ccc",
          borderRadius: 6, background: "#fff",
          outline: "none", cursor: "pointer",
        }}
      >
        {CHAINS.map((c) => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </select>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running || !token}
        style={{
          marginTop: 20, width: "100%",
          padding: "11px 0", fontSize: 14,
          fontWeight: 600, borderRadius: 6,
          border: "none", cursor: running || !token ? "not-allowed" : "pointer",
          background: running || !token ? "#aaa" : "#6d28d9",
          color: "#fff", transition: "background 0.2s",
        }}
      >
        {running ? "Running Analysis…" : "Run Analysis"}
      </button>

      {/* Progress list */}
      {(running || allDone) && (
        <div style={{ marginTop: 28, borderTop: "1px solid #e5e5e5", paddingTop: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>
            Analysis Progress
          </p>

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {MODULES.map((mod) => {
              const s = statuses[mod.id];
              return (
                <li
                  key={mod.id}
                  style={{
                    display: "flex", alignItems: "center",
                    gap: 10, marginBottom: 12,
                  }}
                >
                  {/* Icon */}
                  <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>
                    {s === "done"    ? "✅" :
                     s === "loading" ? "⏳" :
                                       "○"}
                  </span>

                  {/* Label + bar */}
                  <div style={{ flex: 1 }}>
                    <span style={{
                      fontSize: 13,
                      color: s === "done" ? "#111" : s === "loading" ? "#6d28d9" : "#999",
                      fontWeight: s === "loading" ? 600 : 400,
                    }}>
                      {mod.label}
                    </span>

                    {/* Progress track */}
                    <div style={{ height: 3, borderRadius: 4, background: "#eee", marginTop: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 4,
                        background: s === "done" ? "#16a34a" : s === "loading" ? "#7c3aed" : "transparent",
                        width: s === "done" ? "100%" : s === "loading" ? "60%" : "0%",
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  </div>

                  {/* Status label */}
                  <span style={{ fontSize: 11, color: "#aaa", minWidth: 52, textAlign: "right" }}>
                    {s === "done" ? "Done" : s === "loading" ? "Running…" : "Waiting"}
                  </span>
                </li>
              );
            })}
          </ul>

          {allDone && (
            <div style={{ marginTop: 20, padding: "14px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
              <p style={{ fontSize: 13, color: "#166534", margin: "0 0 10px" }}>
                ✅ Analysis complete! Results dashboard coming in the next step.
              </p>
              <button
                onClick={handleReset}
                style={{
                  fontSize: 12, padding: "6px 14px",
                  border: "1px solid #ccc", borderRadius: 6,
                  background: "#fff", cursor: "pointer", color: "#555",
                }}
              >
                Analyze another token
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
