"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type SavedReport = {
  cid:             string;
  tokenName:       string;
  tokenSymbol:     string;
  contractAddress: string;
  chain:           string;
  overall:         number;
  strategy:        string;
  savedAt:         string;
  gateway:         string;
};

const CHAIN_ACCENT: Record<string, string> = {
  ethereum: "#627eea",
  bsc:      "#f0b90b",
  polygon:  "#8247e5",
};

const CHAIN_LABEL: Record<string, string> = {
  ethereum: "Ethereum",
  bsc:      "BNB Chain",
  polygon:  "Polygon",
};

function scoreColor(s: number) {
  return s >= 70 ? "#22c55e" : s >= 40 ? "#eab308" : "#ef4444";
}

function truncate(str: string, start = 8, end = 6) {
  if (str.length <= start + end) return str;
  return `${str.slice(0, start)}…${str.slice(-end)}`;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [copied,  setCopied]  = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sunrise_reports");
      if (raw) setReports(JSON.parse(raw));
    } catch {}
  }, []);

  function deleteReport(cid: string) {
    const next = reports.filter((r) => r.cid !== cid);
    setReports(next);
    localStorage.setItem("sunrise_reports", JSON.stringify(next));
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div style={{
      minHeight:  "100vh",
      background: "linear-gradient(135deg, #050508 0%, #0d0d14 50%, #050508 100%)",
      padding:    "40px 20px 80px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <Link href="/" style={{ fontSize: 13, color: "#8b5cf6", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            ← Back
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/tokens" style={{
              fontSize: 13, fontWeight: 600, color: "#22d3ee", textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8,
              border: "1px solid rgba(34,211,238,0.3)", background: "rgba(34,211,238,0.07)",
            }}>
              🏆 Top Tokens
            </Link>
            <Link href="/analyze" style={{
              fontSize: 13, fontWeight: 600, color: "#b980ff", textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8,
              border: "1px solid rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.08)",
            }}>
              🔍 Analyze Token
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "4px 14px", borderRadius: 20,
            border: "1px solid rgba(139,92,246,0.25)",
            background: "rgba(139,92,246,0.08)",
            fontSize: 11, color: "#a78bfa", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.8px",
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 14 }}>📌</span>
            IPFS Stored
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#ffffff", margin: "0 0 10px", letterSpacing: "-0.5px" }}>
            Historical Reports
          </h1>
          <p style={{ fontSize: 14, color: "#52525b", margin: 0 }}>
            Reports pinned to IPFS — permanent, decentralised, verifiable
          </p>
        </div>

        {reports.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "80px 20px",
            border: "1px dashed #27272a", borderRadius: 20,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <p style={{ fontSize: 15, color: "#52525b", margin: "0 0 20px" }}>
              No reports saved yet
            </p>
            <Link href="/analyze" style={{
              fontSize: 14, fontWeight: 600, color: "#b980ff", textDecoration: "none",
              padding: "10px 24px", borderRadius: 10,
              border: "1px solid rgba(139,92,246,0.3)",
              background: "rgba(139,92,246,0.08)",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              Analyze a token →
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[...reports].reverse().map((r) => {
              const accent = CHAIN_ACCENT[r.chain] ?? "#8b5cf6";
              const color  = scoreColor(r.overall);
              const date   = new Date(r.savedAt).toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric",
              });

              return (
                <div
                  key={r.cid}
                  style={{
                    background:   "rgba(12,12,18,0.95)",
                    border:       `1px solid ${accent}30`,
                    borderRadius: 16,
                    padding:      "20px 24px",
                    display:      "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "12px 24px",
                    alignItems: "center",
                    boxShadow: `0 0 30px ${accent}0a`,
                    transition: "border-color 0.2s",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" as const }}>
                      <span style={{ fontSize: 17, fontWeight: 700, color: "#ffffff" }}>
                        {r.tokenName}
                      </span>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 6,
                        background: `${accent}20`, color: accent,
                        border: `1px solid ${accent}35`, fontWeight: 700,
                      }}>
                        {r.tokenSymbol}
                      </span>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 6,
                        background: "rgba(255,255,255,0.04)", color: "#52525b",
                        fontWeight: 600,
                      }}>
                        {CHAIN_LABEL[r.chain] ?? r.chain}
                      </span>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 6,
                        background: `${color}15`, color, fontWeight: 700,
                      }}>
                        Score {r.overall}/100
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#3f3f46", width: 68, flexShrink: 0 }}>Contract</span>
                        <code style={{
                          fontSize: 11, color: "#a1a1aa", background: "rgba(255,255,255,0.04)",
                          padding: "2px 8px", borderRadius: 5, letterSpacing: "0.3px",
                        }}>
                          {truncate(r.contractAddress)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(r.contractAddress, `addr-${r.cid}`)}
                          style={{
                            fontSize: 10, padding: "2px 8px", borderRadius: 5, cursor: "pointer",
                            border: "1px solid #27272a", background: "transparent",
                            color: copied === `addr-${r.cid}` ? "#22c55e" : "#52525b",
                            transition: "color 0.2s",
                          }}
                        >
                          {copied === `addr-${r.cid}` ? "✓ Copied" : "Copy"}
                        </button>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#3f3f46", width: 68, flexShrink: 0 }}>IPFS CID</span>
                        <code style={{
                          fontSize: 11, color: "#a78bfa", background: "rgba(139,92,246,0.08)",
                          padding: "2px 8px", borderRadius: 5, letterSpacing: "0.3px",
                        }}>
                          {truncate(r.cid, 10, 6)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(r.cid, `cid-${r.cid}`)}
                          style={{
                            fontSize: 10, padding: "2px 8px", borderRadius: 5, cursor: "pointer",
                            border: "1px solid #27272a", background: "transparent",
                            color: copied === `cid-${r.cid}` ? "#22c55e" : "#52525b",
                            transition: "color 0.2s",
                          }}
                        >
                          {copied === `cid-${r.cid}` ? "✓ Copied" : "Copy"}
                        </button>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#3f3f46", width: 68, flexShrink: 0 }}>Strategy</span>
                        <span style={{ fontSize: 11, color: "#71717a" }}>{r.strategy}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#3f3f46", width: 68, flexShrink: 0 }}>Saved</span>
                        <span style={{ fontSize: 11, color: "#3f3f46" }}>{date}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, alignItems: "stretch" }}>
                    <a
                      href={r.gateway}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 8,
                        background: "rgba(139,92,246,0.12)",
                        border: "1px solid rgba(139,92,246,0.25)",
                        color: "#b980ff", textDecoration: "none",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      📄 View on IPFS
                    </a>
                    <Link
                      href={`/analyze?token=${r.contractAddress}&chain=${r.chain}`}
                      style={{
                        fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 8,
                        background: `${accent}12`,
                        border: `1px solid ${accent}30`,
                        color: accent, textDecoration: "none",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      🔄 Re-analyze
                    </Link>
                    <button
                      onClick={() => deleteReport(r.cid)}
                      style={{
                        fontSize: 12, padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                        background: "rgba(239,68,68,0.07)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        color: "#f87171",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      🗑 Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {reports.length > 0 && (
          <div style={{
            marginTop: 20, padding: "12px 20px",
            background: "rgba(139,92,246,0.06)",
            border: "1px solid rgba(139,92,246,0.15)",
            borderRadius: 12, fontSize: 12, color: "#52525b",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{reports.length} report{reports.length !== 1 ? "s" : ""} stored locally · CIDs are permanent on IPFS</span>
            <button
              onClick={() => {
                if (confirm("Clear all saved reports from this browser?")) {
                  setReports([]);
                  localStorage.removeItem("sunrise_reports");
                }
              }}
              style={{
                fontSize: 11, padding: "4px 12px", borderRadius: 6, cursor: "pointer",
                border: "1px solid rgba(239,68,68,0.2)", background: "transparent", color: "#f87171",
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
