"use client";

import { useState, useEffect } from "react";
import Link from "next/link";


// ─── Exchange listing types ────────────────────────────────────────────────
type ExchangeListing = {
  name: string;
  identifier: string;
  type: "dex" | "cex";
  pair: string;
  volumeUsd: number;
  trustScore: string | null;
  url: string | null;
};

type ExchangeListingsData = {
  dexListings: ExchangeListing[];
  cexListings: ExchangeListing[];
  totalDexCount: number;
  totalCexCount: number;
  totalVolumeUsd: number;
  topVenueName: string | null;
  dataNote: string;
};

// ─── Compatibility types (mirrors lib/compatibility.ts) ──────────────────────────
type FlagSeverity = "critical" | "warning" | "info";
interface CompatibilityFlag {
  id:           string;
  label:        string;
  severity:     FlagSeverity;
  detected:     boolean;
  description:  string;
  bridgeImpact: string;
}
interface CompatibilityResult {
  contractName:          string;
  isVerified:            boolean;
  isProxy:               boolean;
  implementationAddress: string | null;
  flags:                 CompatibilityFlag[];
  overallCompatibility:  "compatible" | "caution" | "incompatible";
  compatibilityScore:    number;
  summary:               string;
  bridgeRecommendation:  string;
}

// ─── Severity colours ──────────────────────────────────────────────────────────
const SEV_COLOR: Record<FlagSeverity, string> = {
  critical: "#ef4444",
  warning:  "#eab308",
  info:     "#71717a",
};
const SEV_BG: Record<FlagSeverity, string> = {
  critical: "rgba(239,68,68,0.1)",
  warning:  "rgba(234,179,8,0.1)",
  info:     "rgba(113,113,122,0.1)",
};
const COMPAT_COLOR: Record<string, string> = {
  compatible:   "#22c55e",
  caution:      "#eab308",
  incompatible: "#ef4444",
};
const COMPAT_BG: Record<string, string> = {
  compatible:   "rgba(34,197,94,0.08)",
  caution:      "rgba(234,179,8,0.08)",
  incompatible: "rgba(239,68,68,0.08)",
};
const COMPAT_BORDER: Record<string, string> = {
  compatible:   "rgba(34,197,94,0.25)",
  caution:      "rgba(234,179,8,0.25)",
  incompatible: "rgba(239,68,68,0.25)",
};

// ─── Compatibility Panel component ────────────────────────────────────────────
function CompatibilityPanel({ token, chain }: { token: string; chain: string }) {
  const [status,  setStatus]  = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result,  setResult]  = useState<CompatibilityResult | null>(null);
  const [errMsg,  setErrMsg]  = useState("");
  const [open,    setOpen]    = useState(false);

  useEffect(() => {
    setStatus("loading");
    fetch("/api/compatibility", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token, chain }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) { setErrMsg(data.error || "Check failed"); setStatus("error"); return; }
        setResult(data as CompatibilityResult);
        setStatus("done");
        // Auto-open if there are detected flags
        if (data.flags?.some((f: CompatibilityFlag) => f.detected)) setOpen(true);
      })
      .catch(() => { setErrMsg("Network error"); setStatus("error"); });
  }, [token, chain]);

  const detectedFlags  = result?.flags.filter((f) => f.detected) ?? [];
  const criticalCount  = detectedFlags.filter((f) => f.severity === "critical").length;
  const warningCount   = detectedFlags.filter((f) => f.severity === "warning").length;

  return (
    <div style={{
      background: result ? COMPAT_BG[result.overallCompatibility]  : "rgba(20,20,30,0.6)",
      border:     `1px solid ${ result ? COMPAT_BORDER[result.overallCompatibility] : "#27272a" }`,
      borderRadius: 16, overflow: "hidden", marginBottom: 24,
    }}>
      {/* Header row */}
      <div
        onClick={() => status === "done" && setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: 20,
          cursor: status === "done" ? "pointer" : "default",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 20 }}>🔍</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#e5e5e5", display: "flex", alignItems: "center", gap: 10 }}>
            Contract Safety Scan
            {status === "loading" && (
              <span style={{ fontSize: 11, color: "#52525b", fontWeight: 400 }}>scanning…</span>
            )}
            {status === "done" && result && (
              <span style={{
                fontSize: 11, padding: "2px 9px", borderRadius: 10, fontWeight: 700,
                textTransform: "uppercase" as const, letterSpacing: "0.5px",
                background: COMPAT_BG[result.overallCompatibility],
                color:      COMPAT_COLOR[result.overallCompatibility],
                border:     `1px solid ${COMPAT_BORDER[result.overallCompatibility]}`,
              }}>
                {result.overallCompatibility}
              </span>
            )}
          </div>
          {status === "done" && result && (
            <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>
              {result.contractName !== "Unknown" && <span style={{ color: "#a1a1aa" }}>{result.contractName} · </span>}
              {result.isVerified ? "✓ Verified" : "⚠ Unverified"}
              {result.isProxy && " · Proxy"}
              {criticalCount > 0 && <span style={{ color: "#ef4444", marginLeft: 8 }}>· {criticalCount} critical</span>}
              {warningCount  > 0 && <span style={{ color: "#eab308", marginLeft: 8 }}>· {warningCount} warning{warningCount > 1 ? "s" : ""}</span>}
            </div>
          )}
          {status === "error" && (
            <div style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>⚠ {errMsg}</div>
          )}
        </div>
        {status === "done" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {result && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: COMPAT_COLOR[result.overallCompatibility], lineHeight: 1 }}>
                  {result.compatibilityScore}
                </div>
                <div style={{ fontSize: 10, color: "#52525b" }}>/ 100</div>
              </div>
            )}
            <span style={{ color: "#52525b", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {open && status === "done" && result && (
        <div style={{ padding: "0 20px 20px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {/* Summary */}
          <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6, margin: "16px 0 12px" }}>{result.summary}</p>

          {/* Flags */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 16 }}>
            {result.flags.map((flag) => (
              <div key={flag.id} style={{
                display: "flex", gap: 12, padding: "10px 14px", borderRadius: 10,
                background: flag.detected ? SEV_BG[flag.severity] : "rgba(255,255,255,0.02)",
                border:     `1px solid ${flag.detected ? SEV_COLOR[flag.severity] + "40" : "transparent"}`,
                opacity:    flag.detected ? 1 : 0.45,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>
                  {flag.detected
                    ? flag.severity === "critical" ? "🔴"
                      : flag.severity === "warning" ? "🟡" : "🔵"
                    : "✅"}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: flag.detected ? SEV_COLOR[flag.severity] : "#52525b" }}>
                      {flag.label}
                    </span>
                    {flag.detected && (
                      <span style={{
                        fontSize: 10, padding: "1px 7px", borderRadius: 8,
                        background: SEV_BG[flag.severity],
                        color: SEV_COLOR[flag.severity], fontWeight: 700,
                        textTransform: "uppercase" as const,
                      }}>
                        {flag.severity}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#71717a", lineHeight: 1.5 }}>
                    {flag.description}
                  </p>
                  {flag.detected && (
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: SEV_COLOR[flag.severity], opacity: 0.8, lineHeight: 1.5 }}>
                      Bridge impact: {flag.bridgeImpact}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div style={{
            padding: "12px 16px", borderRadius: 10,
            background: "rgba(139,92,246,0.07)",
            border:     "1px solid rgba(139,92,246,0.2)",
          }}>
            <p style={{ margin: 0, fontSize: 11, color: "#71717a", textTransform: "uppercase" as const, letterSpacing: "0.5px", fontWeight: 600, marginBottom: 6 }}>
              Bridge Recommendation
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
              {result.bridgeRecommendation}
            </p>
          </div>

          {result.isProxy && result.implementationAddress && (
            <p style={{ margin: "12px 0 0", fontSize: 11, color: "#52525b" }}>
              🔗 Implementation: <span style={{ fontFamily: "monospace", color: "#3f3f46" }}>{result.implementationAddress}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const CHAINS = [
  { id: "ethereum", label: "Ethereum" },
  { id: "bsc", label: "BNB Chain" },
  { id: "polygon", label: "Polygon" },
];

// Types for API response
interface AnalysisResult {
  token: {
    address: string;
    chain: string;
    name: string;
    symbol: string;
    image: string | null;
    currentPrice: number;
    marketCap: number;
    circulatingSupply: number;
    totalSupply: number;
    platforms: Record<string, string>;
  };
  scores: {
    demand: number;
    marketPresence: number;
    liquidity: number;
    bridgeRisk: number;
    dumpRisk: number;
    overall: number;
  };
  modules: {
    demand: { score: number; breakdown: Record<string, string | number> };
    marketPresence: {
      score: number;
      breakdown: Record<string, string | number>;
      holderData: {
        uniqueRecipients: number;
        top10TransferPct: number;
        top10Addresses: { address: string; pct: number }[];
        totalTransfersAnalyzed: number;
        supported: boolean;
        dataNote: string;
      };
    };
    liquidity: {
      score: number;
      breakdown: Record<string, string | number>;
      slippage: {
        tradeSizeUsd: number;
        label: string;
        slippagePct: number | null;
        riskLevel: "Low" | "Moderate" | "High" | "Very High" | "N/A";
      }[];
      slippageNote: string;
      sim: {
        hasTvlData: boolean;
        note: string;
        seededTvlUsd: number;
        currentChain: {
          label: string;
          tvlUsd: number;
          slippageTiers: {
            tradeSizeUsd: number;
            label: string;
            slippagePct: number | null;
            riskLevel: "Low" | "Moderate" | "High" | "Very High" | "N/A";
          }[];
          depth1PctUsd: number;
          depth5PctUsd: number;
        };
        solana: {
          label: string;
          tvlUsd: number;
          slippageTiers: {
            tradeSizeUsd: number;
            label: string;
            slippagePct: number | null;
            riskLevel: "Low" | "Moderate" | "High" | "Very High" | "N/A";
          }[];
          depth1PctUsd: number;
          depth5PctUsd: number;
        };
        recommendation: {
          minLpUsd: number;
          targetLpUsd: number;
          rationale: string;
        };
      };
      poolData: {
        totalPoolTvlUsd: number;
        poolCount: number;
        topPools: { name: string; tvlUsd: number; chain: string }[];
        priceConfidence: string;
        dataNote: string;
      };
    };
    bridgeRisk: {
      score: number;
      breakdown: Record<string, string | number>;
      bridges: {
        name: string;
        supported: boolean;
        estimatedCost: string;
        finalityMin: number;
        dataSource: string;
        wormhole: {
          availableNotionalUsd: number | null;
          dailyLimitUsd: number | null;
          maxSingleTxUsd: number | null;
          capacityPct: number | null;
          congestion: "Low" | "Moderate" | "High" | "Unknown";
        } | null;
      }[];
      dataNote: string;
    };
    dumpRisk: {
      score: number;
      breakdown: Record<string, string | number>;
    };
    strategy: { strategy: string; rationale: string };
    overall: number;
  };
  chart: {
    volumeHistory: { date: string; volumeUsd: number }[];
  };
  exchanges: ExchangeListingsData;
}




// ─── Exchange Listings Panel ───────────────────────────────────────────────────────

const TRUST_DOT: Record<string, string> = {
  green:  "#22c55e",
  yellow: "#eab308",
  red:    "#ef4444",
};

function fmtVol(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return n > 0 ? `$${n.toFixed(0)}` : "—";
}

function ExchangeListingsPanel({ data }: { data: ExchangeListingsData }) {
  const [tab, setTab] = useState<"cex" | "dex">("cex");

  const activeListing = tab === "cex" ? data.cexListings : data.dexListings;
  const maxVol = Math.max(...activeListing.map((e) => e.volumeUsd), 1);

  const totalCex = data.totalCexCount;
  const totalDex = data.totalDexCount;

  return (
    <div style={{
      background: "rgba(24,24,27,0.8)",
      border: "1px solid #27272a",
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🏛️</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#e5e5e5" }}>Exchange Listings</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {/* Summary badges */}
            {totalCex > 0 && (
              <span style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
                background: "rgba(59,130,246,0.12)", color: "#60a5fa",
                border: "1px solid rgba(59,130,246,0.25)",
              }}>
                {totalCex} CEX
              </span>
            )}
            {totalDex > 0 && (
              <span style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
                background: "rgba(139,92,246,0.12)", color: "#a78bfa",
                border: "1px solid rgba(139,92,246,0.25)",
              }}>
                {totalDex} DEX
              </span>
            )}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#52525b", margin: "4px 0 16px" }}>
          Total 24h volume across all venues: <span style={{ color: "#a1a1aa", fontWeight: 600 }}>{fmtVol(data.totalVolumeUsd)}</span>
          {data.topVenueName && <> · Top venue: <span style={{ color: "#a1a1aa", fontWeight: 600 }}>{data.topVenueName}</span></>}
        </p>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 2, background: "#0f0f13", borderRadius: 10, padding: 4, width: "fit-content", marginBottom: 0 }}>
          {(["cex", "dex"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 16px", fontSize: 12, fontWeight: 700,
                borderRadius: 8, border: "none", cursor: "pointer",
                textTransform: "uppercase", letterSpacing: "0.5px",
                transition: "all 0.15s",
                background: tab === t
                  ? t === "cex" ? "rgba(59,130,246,0.2)" : "rgba(139,92,246,0.2)"
                  : "transparent",
                color: tab === t
                  ? t === "cex" ? "#60a5fa" : "#a78bfa"
                  : "#52525b",
              }}
            >
              {t === "cex" ? `CEX (${totalCex})` : `DEX (${totalDex})`}
            </button>
          ))}
        </div>
      </div>

      {/* Listing rows */}
      <div style={{ padding: "12px 0 0" }}>
        {activeListing.length === 0 ? (
          <p style={{ padding: "20px 20px", fontSize: 13, color: "#52525b", textAlign: "center" }}>
            No {tab.toUpperCase()} listings found for this token.
          </p>
        ) : (
          activeListing.slice(0, 12).map((entry, i) => {
            const barPct = maxVol > 0 ? (entry.volumeUsd / maxVol) * 100 : 0;
            const dotColor = entry.trustScore ? (TRUST_DOT[entry.trustScore] ?? "#52525b") : null;

            return (
              <div
                key={entry.identifier + i}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 20px",
                  borderTop: i === 0 ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(255,255,255,0.025)",
                  transition: "background 0.15s",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Volume bar (background) */}
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${barPct}%`,
                  background: tab === "cex"
                    ? "rgba(59,130,246,0.05)"
                    : "rgba(139,92,246,0.05)",
                  pointerEvents: "none",
                  transition: "width 0.4s ease",
                }} />

                {/* Rank */}
                <span style={{
                  fontSize: 11, fontWeight: 700, color: "#3f3f46",
                  minWidth: 18, textAlign: "right", flexShrink: 0, zIndex: 1,
                }}>
                  {i + 1}
                </span>

                {/* Trust score dot (CEX only) */}
                {tab === "cex" && dotColor && (
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: dotColor, flexShrink: 0, zIndex: 1,
                  }} />
                )}
                {tab === "cex" && !dotColor && (
                  <span style={{ width: 7, flexShrink: 0, zIndex: 1 }} />
                )}

                {/* DEX icon placeholder */}
                {tab === "dex" && (
                  <span style={{ fontSize: 13, flexShrink: 0, zIndex: 1 }}>⬡</span>
                )}

                {/* Name + pair */}
                <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#e5e5e5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {entry.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#52525b", marginTop: 1 }}>{entry.pair}</div>
                </div>

                {/* Volume */}
                <div style={{ textAlign: "right", zIndex: 1 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: tab === "cex" ? "#60a5fa" : "#a78bfa",
                  }}>
                    {fmtVol(entry.volumeUsd)}
                  </div>
                  <div style={{ fontSize: 10, color: "#3f3f46" }}>24h vol</div>
                </div>

                {/* Trade link */}
                {entry.url && (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 10, padding: "3px 9px", borderRadius: 7, flexShrink: 0,
                      background: tab === "cex" ? "rgba(59,130,246,0.1)" : "rgba(139,92,246,0.1)",
                      color: tab === "cex" ? "#60a5fa" : "#a78bfa",
                      border: `1px solid ${tab === "cex" ? "rgba(59,130,246,0.2)" : "rgba(139,92,246,0.2)"}`,
                      textDecoration: "none", fontWeight: 600, zIndex: 1,
                    }}
                  >
                    Trade ↗
                  </a>
                )}
              </div>
            );
          })
        )}

        {/* show more hint */}
        {activeListing.length > 12 && (
          <p style={{ fontSize: 11, color: "#3f3f46", padding: "10px 20px", textAlign: "center" }}>
            +{activeListing.length - 12} more {tab.toUpperCase()} listings · showing top 12 by volume
          </p>
        )}
      </div>

      {/* Footer note */}
      <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <p style={{ margin: 0, fontSize: 11, color: "#3f3f46" }}>{data.dataNote}</p>
      </div>
    </div>
  );
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#eab308" : "#ef4444";
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 14, color: "#e5e5e5" }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color }}>{score}/100</span>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: "#1f1f23", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 5, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function BreakdownTable({ breakdown }: { breakdown: Record<string, string | number> }) {
  return (
    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
      <tbody>
        {Object.entries(breakdown).map(([key, value]) => (
          <tr key={key} style={{ borderBottom: "1px solid #2a2a2e" }}>
            <td style={{ padding: "12px 0", color: "#a1a1aa" }}>{key}</td>
            <td style={{ padding: "12px 0", textAlign: "right", fontWeight: 500, color: "#e5e5e5" }}>
              {typeof value === "number" ? value : value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Risk badge colours ───────────────────────────────────────────────────────
const RISK_COLOR: Record<string, string> = {
  Low:       "#22c55e",
  Moderate:  "#84cc16",
  High:      "#eab308",
  "Very High": "#ef4444",
  "N/A":     "#71717a",
};
const RISK_BG: Record<string, string> = {
  Low:       "rgba(34,197,94,0.12)",
  Moderate:  "rgba(132,204,22,0.12)",
  High:      "rgba(234,179,8,0.12)",
  "Very High": "rgba(239,68,68,0.12)",
  "N/A":     "rgba(113,113,122,0.12)",
};

type SlippageTierUI = {
  tradeSizeUsd: number;
  label: string;
  slippagePct: number | null;
  riskLevel: "Low" | "Moderate" | "High" | "Very High" | "N/A";
};

function SlippageTable({ tiers, title, tvlUsd, depth1, depth5 }: {
  tiers: SlippageTierUI[];
  title: string;
  tvlUsd: number;
  depth1: number;
  depth5: number;
}) {
  const fmtUsd = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n.toFixed(0)}`;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#e5e5e5" }}>{title}</p>
        <span style={{ fontSize: 11, color: "#52525b" }}>
          Pool TVL: {tvlUsd > 0 ? fmtUsd(tvlUsd) : "N/A"}
        </span>
      </div>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #27272a" }}>
            <th style={{ padding: "8px 0", textAlign: "left",  color: "#71717a", fontWeight: 500 }}>Trade Size</th>
            <th style={{ padding: "8px 0", textAlign: "right", color: "#71717a", fontWeight: 500 }}>Price Impact</th>
            <th style={{ padding: "8px 0", textAlign: "right", color: "#71717a", fontWeight: 500 }}>Risk</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t) => (
            <tr key={t.label} style={{ borderBottom: "1px solid #1a1a1e" }}>
              <td style={{ padding: "11px 0", color: "#d4d4d8", fontFamily: "monospace" }}>{t.label}</td>
              <td style={{ padding: "11px 0", textAlign: "right", color: t.slippagePct != null ? RISK_COLOR[t.riskLevel] : "#52525b", fontFamily: "monospace", fontWeight: 600 }}>
                {t.slippagePct != null ? `~${t.slippagePct < 0.001 ? "<0.001" : t.slippagePct}%` : "N/A"}
              </td>
              <td style={{ padding: "11px 0", textAlign: "right" }}>
                <span style={{
                  fontSize: 11, padding: "3px 9px", borderRadius: 12,
                  background: RISK_BG[t.riskLevel],
                  color: RISK_COLOR[t.riskLevel],
                  fontWeight: 600,
                }}>
                  {t.riskLevel}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tvlUsd > 0 && (
        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          <div style={{ flex: 1, background: "#0f0f13", borderRadius: 8, padding: "10px 14px", border: "1px solid #1f1f27" }}>
            <p style={{ margin: 0, fontSize: 10, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>1% Depth</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e5e5e5" }}>{fmtUsd(depth1)}</p>
          </div>
          <div style={{ flex: 1, background: "#0f0f13", borderRadius: 8, padding: "10px 14px", border: "1px solid #1f1f27" }}>
            <p style={{ margin: 0, fontSize: 10, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>5% Depth</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e5e5e5" }}>{fmtUsd(depth5)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

type SimData = AnalysisResult["modules"]["liquidity"]["sim"];

function LiquiditySimPanel({ sim }: { sim: SimData }) {
  const fmtUsd = (n: number) =>
    n >= 1_000_000_000 ? `$${(n / 1_000_000_000).toFixed(2)}B`
    : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n.toFixed(0)}`;

  return (
    <div style={{ marginTop: 24 }}>
      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
        paddingTop: 20, borderTop: "1px solid #27272a",
      }}>
        <div style={{
          fontSize: 18,
          background: "linear-gradient(135deg, #9945FF, #14F195)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>⬡</div>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e5e5e5" }}>
          Solana Migration Simulation
        </h4>
        <span style={{
          fontSize: 10, padding: "2px 8px", borderRadius: 10,
          background: "rgba(153,69,255,0.15)", color: "#b980ff",
          fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px",
        }}>CPMM Model</span>
      </div>

      {!sim.hasTvlData ? (
        <div style={{ padding: 16, background: "rgba(239,68,68,0.08)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#f87171" }}>⚠ {sim.note}</p>
        </div>
      ) : (
        <>
          {/* A. Current chain slippage */}
          <SlippageTable
            title={`${sim.currentChain.label} — Current DEX Slippage`}
            tiers={sim.currentChain.slippageTiers}
            tvlUsd={sim.currentChain.tvlUsd}
            depth1={sim.currentChain.depth1PctUsd}
            depth5={sim.currentChain.depth5PctUsd}
          />

          {/* B. Solana projection */}
          <div style={{
            padding: "3px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(153,69,255,0.4) 0%, rgba(20,241,149,0.4) 100%)",
            marginBottom: 20,
          }}>
            <div style={{ background: "#0d0d12", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 16 }}>◎</span>
                <p style={{ margin: 0, fontSize: 12, color: "#a1a1aa" }}>
                  Estimates a new Raydium/Orca pool seeded with{" "}
                  <strong style={{ color: "#b980ff" }}>{fmtUsd(sim.seededTvlUsd)}</strong>
                  {" "}(10% of current TVL). CPMM x·y=k model.
                </p>
              </div>
              <SlippageTable
                title={`${sim.solana.label}`}
                tiers={sim.solana.slippageTiers}
                tvlUsd={sim.solana.tvlUsd}
                depth1={sim.solana.depth1PctUsd}
                depth5={sim.solana.depth5PctUsd}
              />
            </div>
          </div>

          {/* C. LP seed recommendation */}
          <div style={{
            padding: 16,
            background: "rgba(20,241,149,0.06)",
            border: "1px solid rgba(20,241,149,0.2)",
            borderRadius: 12,
            marginBottom: 16,
          }}>
            <p style={{ margin: "0 0 6px", fontSize: 12, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>LP Seed Recommendation</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#52525b" }}>Min (for $10K trades &lt;1%)</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#14F195" }}>{fmtUsd(sim.recommendation.minLpUsd)}</p>
              </div>
              <div style={{ width: 1, background: "#27272a" }} />
              <div>
                <p style={{ margin: 0, fontSize: 11, color: "#52525b" }}>Target (for $100K trades &lt;1%)</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#14F195" }}>{fmtUsd(sim.recommendation.targetLpUsd)}</p>
              </div>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 12, color: "#71717a", lineHeight: 1.5 }}>{sim.recommendation.rationale}</p>
          </div>
        </>
      )}

      {/* Model note */}
      <p style={{ margin: "14px 0 0", fontSize: 11, color: "#3f3f46", lineHeight: 1.5 }}>
        ℹ {sim.note}
      </p>
    </div>
  );
}

export default function AnalyzePage() {
  const [token, setToken] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzed, setAnalyzed] = useState<{ token: string; chain: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    const c = params.get("chain");
    if (t) setToken(t);
    if (c) setChain(c);
  }, []);

  async function handleRun() {
    if (!token.startsWith("0x") || token.length !== 42) {
      setError("Enter a valid contract address (0x… 42 chars).");
      return;
    }
    setError("");
    setRunning(true);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, chain }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Analysis failed. Please try again.");
        setRunning(false);
        return;
      }

      setResult(data);
      setAnalyzed({ token, chain });
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }

  function handleReset() {
    setToken("");
    setChain("ethereum");
    setError("");
    setResult(null);
    setAnalyzed(null);
  }

  const formatNumber = (n: number) => {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
    return `$${n.toFixed(2)}`;
  };

  return (
    <div style={{ 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0a0a0f 100%)",
      padding: "40px 20px 80px",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {/* Nav row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <Link href="/" style={{
            fontSize: 13,
            color: "#8b5cf6",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}>
            ← Back
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/tokens" style={{
              fontSize: 13, fontWeight: 600,
              color: "#22d3ee",
              textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8,
              border: "1px solid rgba(34,211,238,0.3)",
              background: "rgba(34,211,238,0.07)",
              transition: "all 0.2s",
            }}>
              🏆 Top Tokens
            </Link>
            <Link href="/compare" style={{
              fontSize: 13, fontWeight: 600,
              color: "#b980ff",
              textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8,
              border: "1px solid rgba(139,92,246,0.3)",
              background: "rgba(139,92,246,0.08)",
              transition: "all 0.2s",
            }}>
              ⚔️ Compare Tokens
            </Link>
          </div>
        </div>

        <h1 style={{ 
          fontSize: 28, 
          fontWeight: 700, 
          marginTop: 24, 
          marginBottom: 8,
          color: "#ffffff",
          letterSpacing: "-0.5px",
        }}>
          Analyze a Token
        </h1>
        <p style={{ fontSize: 15, color: "#71717a", marginBottom: 32, lineHeight: 1.6 }}>
          Enter a contract address and pick the source chain to run the migration readiness check.
        </p>

        {/* Form Card */}
        <div style={{
          background: "rgba(24, 24, 27, 0.8)",
          border: "1px solid #27272a",
          borderRadius: 16,
          padding: 24,
          marginBottom: 32,
          backdropFilter: "blur(12px)",
        }}>
          {/* Token address */}
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#a1a1aa" }}>
            Token Contract Address
          </label>
          <input
            type="text"
            value={token}
            onChange={(e) => { setToken(e.target.value); setError(""); }}
            placeholder="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
            disabled={running}
            style={{
              width: "100%", 
              boxSizing: "border-box",
              padding: "14px 16px", 
              fontSize: 14,
              fontFamily: "monospace", 
              border: "1px solid #3f3f46",
              borderRadius: 10, 
              outline: "none",
              background: running ? "#1f1f23" : "#09090b",
              color: "#e5e5e5",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#8b5cf6";
              e.target.style.boxShadow = "0 0 0 3px rgba(139, 92, 246, 0.15)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#3f3f46";
              e.target.style.boxShadow = "none";
            }}
          />
          {error && (
            <p style={{ fontSize: 13, color: "#f87171", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span>⚠</span> {error}
            </p>
          )}

          {/* Chain selector */}
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginTop: 20, marginBottom: 8, color: "#a1a1aa" }}>
            Source Chain
          </label>
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            disabled={running}
            style={{
              width: "100%", 
              padding: "14px 16px",
              fontSize: 14, 
              border: "1px solid #3f3f46",
              borderRadius: 10, 
              background: "#09090b",
              color: "#e5e5e5",
              outline: "none", 
              cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2371717a'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
              backgroundSize: "20px",
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
              marginTop: 24, 
              width: "100%",
              padding: "14px 0", 
              fontSize: 15,
              fontWeight: 600, 
              borderRadius: 10,
              border: "none", 
              cursor: running || !token ? "not-allowed" : "pointer",
              background: running || !token 
                ? "linear-gradient(135deg, #3f3f46 0%, #27272a 100%)" 
                : "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
              color: running || !token ? "#71717a" : "#fff",
              transition: "all 0.2s",
              boxShadow: running || !token ? "none" : "0 4px 14px rgba(139, 92, 246, 0.4)",
            }}
          >
            {running ? "Running Analysis…" : "Run Analysis"}
          </button>
        </div>

        {/* Loading state */}
        {running && (
          <div style={{ 
            textAlign: "center", 
            padding: 60,
            background: "rgba(24, 24, 27, 0.6)",
            borderRadius: 16,
            border: "1px solid #27272a",
          }}>
            <div style={{ 
              fontSize: 48, 
              marginBottom: 16,
              animation: "pulse 2s infinite",
            }}>⏳</div>
            <p style={{ fontSize: 15, color: "#a1a1aa" }}>
              Fetching data from CoinGecko, Etherscan, and DeFiLlama...
            </p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div>
            {/* Token Header */}
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 20, 
              padding: 24, 
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)",
              border: "1px solid rgba(139, 92, 246, 0.2)",
              borderRadius: 16, 
              marginBottom: 24,
            }}>
              {result.token.image && (
                <img 
                  src={result.token.image} 
                  alt={result.token.symbol} 
                  style={{ width: 56, height: 56, borderRadius: 12, background: "#18181b" }} 
                />
              )}
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#ffffff" }}>
                  {result.token.name} <span style={{ color: "#71717a", fontWeight: 400 }}>({result.token.symbol})</span>
                </h2>
                <p style={{ fontSize: 14, color: "#a1a1aa", margin: "6px 0 0" }}>
                  {formatNumber(result.token.currentPrice)} · MCap: {formatNumber(result.token.marketCap)}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ 
                  fontSize: 40, 
                  fontWeight: 700, 
                  color: result.scores.overall >= 70 ? "#22c55e" : result.scores.overall >= 40 ? "#eab308" : "#ef4444",
                  lineHeight: 1,
                }}>
                  {result.scores.overall}
                </div>
                <div style={{ fontSize: 11, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4 }}>
                  Overall Score
                </div>
              </div>
            </div>

            {/* Score Summary */}
            <div style={{ 
              padding: 24, 
              background: "rgba(24, 24, 27, 0.8)",
              border: "1px solid #27272a", 
              borderRadius: 16, 
              marginBottom: 24,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 20px", color: "#ffffff" }}>Score Summary</h3>
              <ScoreBar score={result.scores.demand} label="Market Demand" />
              <ScoreBar score={result.scores.marketPresence} label="Market Presence" />
              <ScoreBar score={result.scores.liquidity} label="Liquidity" />
              <ScoreBar score={result.scores.bridgeRisk} label="Bridge Risk" />
              <div style={{ marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, color: "#e5e5e5" }}>Dump Risk</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: result.scores.dumpRisk >= 70 ? "#ef4444" : result.scores.dumpRisk >= 50 ? "#f97316" : result.scores.dumpRisk >= 30 ? "#eab308" : "#22c55e" }}>
                    {result.scores.dumpRisk}/100
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: "#1f1f23", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${result.scores.dumpRisk}%`, borderRadius: 5, transition: "width 0.5s ease",
                    background: result.scores.dumpRisk >= 70 ? "#ef4444" : result.scores.dumpRisk >= 50 ? "#f97316" : result.scores.dumpRisk >= 30 ? "#eab308" : "#22c55e",
                  }} />
                </div>
              </div>
            </div>

            {/* Strategy Recommendation */}
            <div style={{ 
              padding: 24, 
              background: "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.05) 100%)",
              border: "1px solid rgba(34, 197, 94, 0.2)", 
              borderRadius: 16, 
              marginBottom: 24,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px", color: "#22c55e" }}>
                Recommended: {result.modules.strategy.strategy}
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: "#a1a1aa", lineHeight: 1.6 }}>
                {result.modules.strategy.rationale}
              </p>
            </div>

            {/* Contract Safety Scan — loads independently after main analysis */}
            {analyzed && (
              <CompatibilityPanel key={analyzed.token + analyzed.chain} token={analyzed.token} chain={analyzed.chain} />
            )}

            {/* Exchange Listings — DEX & CEX */}
            {result.exchanges && (
              <ExchangeListingsPanel data={result.exchanges} />
            )}

            {/* Module Breakdowns */}
            <div style={{ display: "grid", gap: 16 }}>
              {/* Demand */}
              <details style={{ 
                background: "rgba(24, 24, 27, 0.8)",
                border: "1px solid #27272a", 
                borderRadius: 16, 
                overflow: "hidden",
              }}>
                <summary style={{ 
                  cursor: "pointer", 
                  fontSize: 15, 
                  fontWeight: 600, 
                  color: "#e5e5e5",
                  padding: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  listStyle: "none",
                }}>
                  <span>Market Demand Breakdown</span>
                  <span style={{ 
                    background: result.modules.demand.score >= 70 ? "rgba(34, 197, 94, 0.2)" : result.modules.demand.score >= 40 ? "rgba(234, 179, 8, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    color: result.modules.demand.score >= 70 ? "#22c55e" : result.modules.demand.score >= 40 ? "#eab308" : "#ef4444",
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {result.modules.demand.score}/100
                  </span>
                </summary>
                <div style={{ padding: "0 20px 20px" }}>
                  <BreakdownTable breakdown={result.modules.demand.breakdown} />
                </div>
              </details>

              {/* Market Presence */}
              <details style={{ 
                background: "rgba(24, 24, 27, 0.8)",
                border: "1px solid #27272a", 
                borderRadius: 16, 
                overflow: "hidden",
              }}>
                <summary style={{ 
                  cursor: "pointer", 
                  fontSize: 15, 
                  fontWeight: 600, 
                  color: "#e5e5e5",
                  padding: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  listStyle: "none",
                }}>
                  <span>Market Presence Breakdown</span>
                  <span style={{ 
                    background: result.modules.marketPresence.score >= 70 ? "rgba(34, 197, 94, 0.2)" : result.modules.marketPresence.score >= 40 ? "rgba(234, 179, 8, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    color: result.modules.marketPresence.score >= 70 ? "#22c55e" : result.modules.marketPresence.score >= 40 ? "#eab308" : "#ef4444",
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {result.modules.marketPresence.score}/100
                  </span>
                </summary>
                <div style={{ padding: "0 20px 20px" }}>
                  <BreakdownTable breakdown={result.modules.marketPresence.breakdown} />
                  {result.modules.marketPresence.holderData.supported && (
                    <div style={{ marginTop: 16, padding: 16, background: "#18181b", borderRadius: 10, border: "1px solid #27272a" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5", margin: "0 0 8px" }}>Top Holders</p>
                      <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>
                        Unique recipients: {result.modules.marketPresence.holderData.uniqueRecipients.toLocaleString()} · 
                        Top 10 concentration: {result.modules.marketPresence.holderData.top10TransferPct.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              </details>

              {/* Liquidity */}
              <details style={{ 
                background: "rgba(24, 24, 27, 0.8)",
                border: "1px solid #27272a", 
                borderRadius: 16, 
                overflow: "hidden",
              }}>
                <summary style={{ 
                  cursor: "pointer", 
                  fontSize: 15, 
                  fontWeight: 600, 
                  color: "#e5e5e5",
                  padding: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  listStyle: "none",
                }}>
                  <span>Liquidity Breakdown</span>
                  <span style={{ 
                    background: result.modules.liquidity.score >= 70 ? "rgba(34, 197, 94, 0.2)" : result.modules.liquidity.score >= 40 ? "rgba(234, 179, 8, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    color: result.modules.liquidity.score >= 70 ? "#22c55e" : result.modules.liquidity.score >= 40 ? "#eab308" : "#ef4444",
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {result.modules.liquidity.score}/100
                  </span>
                </summary>
                <div style={{ padding: "0 20px 20px" }}>
                  <BreakdownTable breakdown={result.modules.liquidity.breakdown} />
                  <div style={{ marginTop: 16, padding: 16, background: "#18181b", borderRadius: 10, border: "1px solid #27272a" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5", margin: "0 0 8px" }}>
                      Pool Data ({result.modules.liquidity.poolData.poolCount} pools · TVL: {formatNumber(result.modules.liquidity.poolData.totalPoolTvlUsd)})
                    </p>
                    {result.modules.liquidity.poolData.topPools.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: "#71717a" }}>
                        {result.modules.liquidity.poolData.topPools.slice(0, 5).map((pool, i) => (
                          <li key={i} style={{ marginBottom: 4 }}>{pool.name} - {formatNumber(pool.tvlUsd)} ({pool.chain})</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {/* ── Liquidity Simulation Panel ─────────────────────────────────── */}
                  {result.modules.liquidity.sim && (
                    <LiquiditySimPanel sim={result.modules.liquidity.sim} />
                  )}
                </div>
              </details>

              {/* Bridge Risk */}
              <details style={{ 
                background: "rgba(24, 24, 27, 0.8)",
                border: "1px solid #27272a", 
                borderRadius: 16, 
                overflow: "hidden",
              }}>
                <summary style={{ 
                  cursor: "pointer", 
                  fontSize: 15, 
                  fontWeight: 600, 
                  color: "#e5e5e5",
                  padding: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  listStyle: "none",
                }}>
                  <span>Bridge Risk Breakdown</span>
                  <span style={{ 
                    background: result.modules.bridgeRisk.score >= 70 ? "rgba(34, 197, 94, 0.2)" : result.modules.bridgeRisk.score >= 40 ? "rgba(234, 179, 8, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    color: result.modules.bridgeRisk.score >= 70 ? "#22c55e" : result.modules.bridgeRisk.score >= 40 ? "#eab308" : "#ef4444",
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {result.modules.bridgeRisk.score}/100
                  </span>
                </summary>
                <div style={{ padding: "0 20px 20px" }}>
                  <BreakdownTable breakdown={result.modules.bridgeRisk.breakdown} />
                  {result.modules.bridgeRisk.bridges.length > 0 && (
                    <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {result.modules.bridgeRisk.bridges.map((bridge, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 12,
                            background: bridge.supported ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                            border: `1px solid ${bridge.supported ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                            minWidth: 160,
                            flex: "1 1 160px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: bridge.supported ? "#22c55e" : "#ef4444" }}>
                              {bridge.supported ? "✓" : "✗"} {bridge.name}
                            </span>
                            {bridge.wormhole?.congestion && (
                              <span style={{
                                fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600,
                                background: bridge.wormhole.congestion === "Low" ? "rgba(34,197,94,0.2)" : bridge.wormhole.congestion === "High" ? "rgba(239,68,68,0.2)" : "rgba(234,179,8,0.2)",
                                color: bridge.wormhole.congestion === "Low" ? "#22c55e" : bridge.wormhole.congestion === "High" ? "#ef4444" : "#eab308",
                              }}>
                                {bridge.wormhole.congestion}
                              </span>
                            )}
                          </div>
                          {bridge.supported && (
                            <>
                              <div style={{ fontSize: 11, color: "#71717a" }}>Est. cost: <span style={{ color: "#a1a1aa" }}>{bridge.estimatedCost}</span></div>
                              <div style={{ fontSize: 11, color: "#71717a" }}>Finality: <span style={{ color: "#a1a1aa" }}>{bridge.finalityMin} min</span></div>
                              {bridge.wormhole?.maxSingleTxUsd && (
                                <div style={{ fontSize: 11, color: "#71717a" }}>Max tx: <span style={{ color: "#a1a1aa" }}>
                                  {bridge.wormhole.maxSingleTxUsd >= 1_000_000
                                    ? `$${(bridge.wormhole.maxSingleTxUsd / 1_000_000).toFixed(1)}M`
                                    : `$${(bridge.wormhole.maxSingleTxUsd / 1_000).toFixed(0)}K`}
                                </span></div>
                              )}
                            </>
                          )}
                          <div style={{ fontSize: 10, color: "#3f3f46", marginTop: 6 }}>{bridge.dataSource}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>

              {/* Dump Risk */}
              <details style={{
                background: "rgba(24, 24, 27, 0.8)",
                border: result.modules.dumpRisk.score >= 70
                  ? "1px solid rgba(239,68,68,0.35)"
                  : result.modules.dumpRisk.score >= 50
                  ? "1px solid rgba(249,115,22,0.35)"
                  : "1px solid #27272a",
                borderRadius: 16,
                overflow: "hidden",
              }}>
                <summary style={{
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#e5e5e5",
                  padding: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  listStyle: "none",
                }}>
                  <span>⚠ Dump Risk Analysis</span>
                  <span style={{
                    background: result.modules.dumpRisk.score >= 70
                      ? "rgba(239,68,68,0.2)"
                      : result.modules.dumpRisk.score >= 50
                      ? "rgba(249,115,22,0.2)"
                      : result.modules.dumpRisk.score >= 30
                      ? "rgba(234,179,8,0.2)"
                      : "rgba(34,197,94,0.2)",
                    color: result.modules.dumpRisk.score >= 70
                      ? "#ef4444"
                      : result.modules.dumpRisk.score >= 50
                      ? "#f97316"
                      : result.modules.dumpRisk.score >= 30
                      ? "#eab308"
                      : "#22c55e",
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {result.modules.dumpRisk.score}/100
                  </span>
                </summary>
                <div style={{ padding: "0 20px 20px" }}>
                  <p style={{ fontSize: 12, color: "#71717a", margin: "0 0 16px", lineHeight: 1.5 }}>
                    Higher score = higher dump risk. Signals whale concentration,
                    supply unlock pressure, and speculative momentum.
                  </p>
                  <BreakdownTable breakdown={result.modules.dumpRisk.breakdown} />
                </div>
              </details>
            </div>

            {/* Reset button */}
            <div style={{ marginTop: 40, textAlign: "center" }}>
              <button
                onClick={handleReset}
                style={{
                  fontSize: 14, 
                  padding: "12px 28px",
                  border: "1px solid #3f3f46", 
                  borderRadius: 10,
                  background: "transparent", 
                  cursor: "pointer", 
                  color: "#a1a1aa",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#8b5cf6";
                  e.currentTarget.style.color = "#8b5cf6";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#3f3f46";
                  e.currentTarget.style.color = "#a1a1aa";
                }}
              >
                Analyze another token
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
        details summary::-webkit-details-marker {
          display: none;
        }
        details[open] summary {
          border-bottom: 1px solid #27272a;
        }
      `}</style>
    </div>
  );
}
