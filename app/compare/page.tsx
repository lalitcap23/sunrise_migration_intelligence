"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface ScoreSnapshot {
  demand:        number;
  marketPresence: number;
  liquidity:     number;
  bridgeRisk:    number;
  dumpRisk:      number;
  overall:       number;
}

interface TokenMeta {
  name:         string;
  symbol:       string;
  image:        string | null;
  currentPrice: number;
  marketCap:    number;
}

interface StrategyResult {
  strategy:  string;
  rationale: string;
}

interface CompareToken {
  id:     string;
  token:  string;
  chain:  string;
}

interface CompareResult {
  id:       string;
  token:    string;
  chain:    string;
  status:   "idle" | "loading" | "done" | "error";
  error?:   string;
  meta?:    TokenMeta;
  scores?:  ScoreSnapshot;
  strategy?: StrategyResult;
}

const CHAINS = [
  { id: "ethereum", label: "Ethereum", icon: "⟠" },
  { id: "bsc",      label: "BNB Chain", icon: "⬡" },
  { id: "polygon",  label: "Polygon",   icon: "⬡" },
];

const CATEGORIES = [
  { key: "demand",         label: "Market Demand",    info: false },
  { key: "marketPresence", label: "Market Presence",  info: false },
  { key: "liquidity",      label: "Liquidity",        info: false },
  { key: "bridgeRisk",     label: "Bridge Risk",      info: false },
  { key: "dumpRisk",       label: "Dump Risk",        info: true  },
] as const;

function scoreColor(score: number, inverse = false): string {
  const s = inverse ? 100 - score : score;
  return s >= 70 ? "#22c55e" : s >= 40 ? "#eab308" : "#ef4444";
}

function scoreBg(score: number, inverse = false): string {
  const s = inverse ? 100 - score : score;
  return s >= 70
    ? "rgba(34,197,94,0.12)"
    : s >= 40
    ? "rgba(234,179,8,0.12)"
    : "rgba(239,68,68,0.12)";
}

function fmtMoney(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const MEDALS = ["🥇", "🥈", "🥉", "4️⃣"];

let idCounter = 0;
function newId() { return `t-${++idCounter}`; }

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r     = (size - 8) / 2;
  const circ  = 2 * Math.PI * r;
  const fill  = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1f1f27" strokeWidth={6} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dasharray 0.7s ease" }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fill={color} fontSize={size * 0.26} fontWeight={700} fontFamily="system-ui">
        {score}
      </text>
    </svg>
  );
}

export default function ComparePage() {
  const [tokens, setTokens] = useState<CompareToken[]>([
    { id: newId(), token: "", chain: "ethereum" },
    { id: newId(), token: "", chain: "ethereum" },
  ]);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [running, setRunning] = useState(false);
  const [hasRun,  setHasRun]  = useState(false);

  const addSlot = () => {
    if (tokens.length < 4)
      setTokens((prev) => [...prev, { id: newId(), token: "", chain: "ethereum" }]);
  };
  const removeSlot = (id: string) => {
    if (tokens.length > 2) setTokens((prev) => prev.filter((t) => t.id !== id));
  };
  const updateSlot = (id: string, field: "token" | "chain", value: string) => {
    setTokens((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const runComparison = useCallback(async () => {
    const valid = tokens.filter((t) => t.token.startsWith("0x") && t.token.length === 42);
    if (valid.length < 1) return;

    setRunning(true);
    setHasRun(true);

    const initial: CompareResult[] = valid.map((t) => ({
      id: t.id, token: t.token, chain: t.chain, status: "loading",
    }));
    setResults(initial);

    const fetches = valid.map(async (t): Promise<CompareResult> => {
      try {
        const res  = await fetch("/api/analyze", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ token: t.token, chain: t.chain }),
        });
        const data = await res.json();
        if (!res.ok) return { ...t, status: "error", error: data.error || "Analysis failed" };

        return {
          ...t,
          status: "done",
          meta: {
            name:         data.token.name,
            symbol:       data.token.symbol,
            image:        data.token.image,
            currentPrice: data.token.currentPrice,
            marketCap:    data.token.marketCap,
          },
          scores:   data.scores,
          strategy: data.modules.strategy,
        };
      } catch {
        return { ...t, status: "error", error: "Network error" };
      }
    });

    const promises = fetches.map((p, i) =>
      p.then((result) => {
        setResults((prev) => {
          const next = [...prev];
          next[i] = result;
          return next;
        });
        return result;
      })
    );

    await Promise.allSettled(promises);
    setRunning(false);
  }, [tokens]);

  const validInputs    = tokens.filter((t) => t.token.startsWith("0x") && t.token.length === 42);
  const doneResults    = results.filter((r) => r.status === "done");
  const ranked         = [...doneResults].sort((a, b) => (b.scores?.overall ?? 0) - (a.scores?.overall ?? 0));

  return (
    <div style={{
      minHeight:   "100vh",
      background:  "linear-gradient(135deg, #0a0a0f 0%, #0d0d18 50%, #0a0a0f 100%)",
      padding:     "40px 20px 80px",
      fontFamily:  "system-ui, -apple-system, sans-serif",
      color:       "#e5e5e5",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontSize: 13, color: "#8b5cf6", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
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
            }}>
              🏆 Top Tokens
            </Link>
            <Link href="/analyze" style={{
              fontSize: 13, fontWeight: 600,
              color: "#b980ff",
              textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8,
              border: "1px solid rgba(139,92,246,0.3)",
              background: "rgba(139,92,246,0.08)",
            }}>
              🔍 Analyze Token
            </Link>
          </div>
        </div>

        <div style={{ marginTop: 28, marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>
              Token Battle{" "}
              <span style={{
                background: "linear-gradient(90deg, #8b5cf6, #22d3ee)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>Compare</span>
            </h1>
            <span style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 20,
              background: "rgba(139,92,246,0.15)", color: "#b980ff",
              fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px",
              border: "1px solid rgba(139,92,246,0.25)",
            }}>Beta</span>
          </div>
          <p style={{ fontSize: 15, color: "#71717a", marginTop: 8, maxWidth: 600 }}>
            Analyze up to 4 tokens side-by-side. Ranked by Migration Readiness Score — instantly see which asset to migrate first.
          </p>
        </div>

        {/* Input Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(tokens.length, 4)}, 1fr)`,
          gap: 12,
          marginBottom: 20,
        }}>
          {tokens.map((t, i) => (
            <div key={t.id} style={{
              background:   "rgba(20,20,30,0.8)",
              border:       "1px solid #27272a",
              borderRadius: 14,
              padding:      "16px",
              position:     "relative",
              backdropFilter: "blur(10px)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#52525b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  Token {i + 1}
                </span>
                {tokens.length > 2 && (
                  <button onClick={() => removeSlot(t.id)} style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171", fontSize: 14, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>×</button>
                )}
              </div>

              {/* Address input */}
              <input
                type="text"
                value={t.token}
                onChange={(e) => updateSlot(t.id, "token", e.target.value)}
                placeholder="0x..."
                disabled={running}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "10px 12px", fontSize: 12,
                  fontFamily: "monospace", border: "1px solid #3f3f46",
                  borderRadius: 8, background: "#09090b",
                  color: "#e5e5e5", outline: "none",
                  marginBottom: 10,
                  borderColor: t.token.length > 0 && (!t.token.startsWith("0x") || t.token.length !== 42)
                    ? "rgba(239,68,68,0.5)" : "#3f3f46",
                }}
              />

              {/* Chain selector */}
              <select
                value={t.chain}
                onChange={(e) => updateSlot(t.id, "chain", e.target.value)}
                disabled={running}
                style={{
                  width: "100%", padding: "9px 12px", fontSize: 13,
                  border: "1px solid #3f3f46", borderRadius: 8,
                  background: "#09090b", color: "#e5e5e5",
                  outline: "none", cursor: "pointer",
                }}
              >
                {CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Action Row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 40, alignItems: "center" }}>
          {tokens.length < 4 && (
            <button
              onClick={addSlot}
              disabled={running}
              style={{
                padding: "10px 20px", fontSize: 13, borderRadius: 10,
                border: "1px dashed #3f3f46",
                background: "transparent", color: "#71717a",
                cursor: "pointer", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#8b5cf6";
                e.currentTarget.style.color = "#b980ff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#3f3f46";
                e.currentTarget.style.color = "#71717a";
              }}
            >
              + Add Token
            </button>
          )}

          <button
            onClick={runComparison}
            disabled={running || validInputs.length < 1}
            style={{
              padding: "10px 32px", fontSize: 14, fontWeight: 600,
              borderRadius: 10, border: "none",
              cursor: running || validInputs.length < 1 ? "not-allowed" : "pointer",
              background: running || validInputs.length < 1
                ? "linear-gradient(135deg, #3f3f46, #27272a)"
                : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
              color: running || validInputs.length < 1 ? "#71717a" : "#fff",
              boxShadow: running || validInputs.length < 1 ? "none" : "0 4px 18px rgba(139,92,246,0.4)",
              transition: "all 0.2s",
            }}
          >
            {running ? "Running Analysis…" : `Compare ${validInputs.length > 0 ? validInputs.length : ""} Token${validInputs.length !== 1 ? "s" : ""}`}
          </button>

          {doneResults.length > 0 && (
            <button
              onClick={() => {
                // Export as CSV
                const headers = ["Token", "Chain", "Symbol", "Overall", "Demand", "Market Presence", "Liquidity", "Bridge Risk", "Dump Risk", "Strategy"];
                const rows = ranked.map((r) => [
                  r.token, r.chain,
                  r.meta?.symbol ?? "",
                  r.scores?.overall ?? "",
                  r.scores?.demand ?? "",
                  r.scores?.marketPresence ?? "",
                  r.scores?.liquidity ?? "",
                  r.scores?.bridgeRisk ?? "",
                  r.scores?.dumpRisk ?? "",
                  r.strategy?.strategy ?? "",
                ]);
                const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement("a");
                a.href     = url;
                a.download = "sunrise-comparison.csv";
                a.click();
              }}
              style={{
                marginLeft: "auto",
                padding: "10px 20px", fontSize: 13, borderRadius: 10,
                border: "1px solid #27272a",
                background: "rgba(255,255,255,0.03)",
                color: "#71717a", cursor: "pointer",
              }}
            >
              ↓ Export CSV
            </button>
          )}
        </div>

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {hasRun && results.length > 0 && (
          <div>
            {/* Loading cards */}
            {results.some((r) => r.status === "loading") && (
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${results.length}, 1fr)`,
                gap: 12, marginBottom: 24,
              }}>
                {results.map((r) => r.status === "loading" && (
                  <div key={r.id} style={{
                    padding: 28, background: "rgba(20,20,30,0.8)",
                    border: "1px solid #27272a", borderRadius: 14,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1.5s linear infinite" }}>⏳</div>
                    <p style={{ fontSize: 12, color: "#52525b", fontFamily: "monospace", wordBreak: "break-all" }}>
                      {r.token.slice(0, 10)}…{r.token.slice(-6)}
                    </p>
                    <p style={{ fontSize: 12, color: "#71717a", marginTop: 6 }}>Fetching data…</p>
                  </div>
                ))}
              </div>
            )}

            {/* Leaderboard */}
            {ranked.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px", color: "#fff" }}>
                  🏆 Leaderboard — Ranked by Migration Readiness
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ranked.map((r, i) => (
                    <div key={r.id} style={{
                      display: "flex", alignItems: "center", gap: 16,
                      padding: "14px 20px",
                      background: i === 0
                        ? "linear-gradient(90deg, rgba(139,92,246,0.12), rgba(34,211,238,0.06))"
                        : "rgba(20,20,30,0.6)",
                      border: i === 0 ? "1px solid rgba(139,92,246,0.25)" : "1px solid #27272a",
                      borderRadius: 12, position: "relative", overflow: "hidden",
                    }}>
                      {/* Rank fill bar */}
                      <div style={{
                        position: "absolute", top: 0, left: 0, bottom: 0,
                        width: `${r.scores!.overall}%`,
                        background: scoreColor(r.scores!.overall),
                        opacity: 0.04,
                        transition: "width 0.8s ease",
                      }} />

                      <span style={{ fontSize: 22 }}>{MEDALS[i]}</span>

                      {r.meta?.image && (
                        <img src={r.meta.image} alt={r.meta.symbol}
                          style={{ width: 36, height: 36, borderRadius: 8, background: "#18181b" }} />
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>
                          {r.meta?.name ?? "—"}{" "}
                          <span style={{ color: "#71717a", fontWeight: 400, fontSize: 13 }}>
                            ({r.meta?.symbol ?? r.token.slice(0, 8)})
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#52525b", marginTop: 2 }}>
                          {CHAINS.find((c) => c.id === r.chain)?.label} ·{" "}
                          {r.meta ? fmtMoney(r.meta.marketCap) + " MCap" : r.token.slice(0, 10) + "…"}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          fontSize: 28, fontWeight: 700,
                          color: scoreColor(r.scores!.overall),
                          lineHeight: 1,
                        }}>
                          {r.scores!.overall}
                        </div>
                        <div style={{ fontSize: 11, color: "#52525b", marginTop: 2 }}>/ 100</div>
                      </div>

                      <div style={{
                        fontSize: 12, padding: "4px 12px", borderRadius: 20,
                        background: scoreBg(r.scores!.overall),
                        color: scoreColor(r.scores!.overall),
                        fontWeight: 600, whiteSpace: "nowrap",
                      }}>
                        {r.strategy?.strategy}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Score Comparison Matrix ──────────────────────────────────── */}
            {doneResults.length > 0 && (
              <div style={{
                background: "rgba(20,20,30,0.8)", border: "1px solid #27272a",
                borderRadius: 16, overflow: "hidden", marginBottom: 32,
              }}>
                <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #27272a" }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#fff" }}>
                    Score Breakdown Matrix
                  </h2>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #27272a" }}>
                        <th style={{ padding: "12px 24px", textAlign: "left", color: "#52525b", fontWeight: 500, fontSize: 12 }}>
                          Category
                        </th>
                        {doneResults.map((r) => (
                          <th key={r.id} style={{ padding: "12px 16px", textAlign: "center", color: "#e5e5e5", fontWeight: 600, fontSize: 13 }}>
                            {r.meta?.symbol ?? r.token.slice(0, 8)}
                            <div style={{ fontSize: 10, color: "#52525b", fontWeight: 400, marginTop: 2 }}>
                              {CHAINS.find((c) => c.id === r.chain)?.label}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {CATEGORIES.map(({ key, label, info }) => (
                        <tr key={key} style={{ borderBottom: "1px solid #18181b" }}>
                          <td style={{ padding: "14px 24px", fontSize: 13, color: "#a1a1aa", fontWeight: 500 }}>
                            {label}
                            {info && <span style={{ marginLeft: 6, fontSize: 10, color: "#52525b" }}>(lower=better)</span>}
                          </td>
                          {doneResults.map((r) => {
                            const rawScore = r.scores?.[key] ?? 0;
                            const displayScore = rawScore;
                            const color = key === "dumpRisk" ? scoreColor(displayScore, true) : scoreColor(displayScore);
                            const bg    = key === "dumpRisk" ? scoreBg(displayScore, true) : scoreBg(displayScore);

                            return (
                              <td key={r.id} style={{ padding: "14px 16px", textAlign: "center" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                                  <span style={{
                                    fontSize: 20, fontWeight: 700, color,
                                  }}>
                                    {displayScore}
                                  </span>
                                  {/* Mini bar */}
                                  <div style={{ width: 56, height: 4, borderRadius: 2, background: "#1f1f27", overflow: "hidden" }}>
                                    <div style={{
                                      height: "100%",
                                      width: `${key === "dumpRisk" ? 100 - displayScore : displayScore}%`,
                                      background: color, borderRadius: 2,
                                      transition: "width 0.6s ease",
                                    }} />
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Overall row */}
                      <tr style={{ borderTop: "1px solid #27272a", background: "rgba(139,92,246,0.04)" }}>
                        <td style={{ padding: "16px 24px", fontSize: 14, color: "#b980ff", fontWeight: 700 }}>
                          Overall Score
                        </td>
                        {doneResults.map((r) => {
                          const score = r.scores?.overall ?? 0;
                          const isWinner = ranked[0]?.id === r.id;
                          return (
                            <td key={r.id} style={{ padding: "16px", textAlign: "center" }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <ScoreRing score={score} size={68} />
                                {isWinner && (
                                  <span style={{
                                    fontSize: 10, padding: "2px 8px", borderRadius: 10,
                                    background: "rgba(139,92,246,0.2)", color: "#b980ff",
                                    fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
                                  }}>
                                    Best Pick
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Strategy Cards ───────────────────────────────────────────── */}
            {doneResults.length > 0 && (
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "#fff" }}>
                  Migration Strategy per Token
                </h2>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))`,
                  gap: 14,
                }}>
                  {doneResults.map((r) => (
                    <div key={r.id} style={{
                      padding: 20,
                      background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(22,163,74,0.04))",
                      border: "1px solid rgba(34,197,94,0.2)",
                      borderRadius: 14,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        {r.meta?.image && (
                          <img src={r.meta.image} alt="" style={{ width: 28, height: 28, borderRadius: 6 }} />
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>
                            {r.meta?.symbol ?? r.token.slice(0, 8)}
                          </div>
                          <div style={{ fontSize: 11, color: "#52525b" }}>
                            {CHAINS.find((c) => c.id === r.chain)?.label}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: "#22c55e", marginBottom: 8,
                      }}>
                        {r.strategy?.strategy}
                      </div>
                      <div style={{ fontSize: 12, color: "#71717a", lineHeight: 1.6 }}>
                        {r.strategy?.rationale}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error states */}
            {results.filter((r) => r.status === "error").map((r) => (
              <div key={r.id} style={{
                padding: "14px 20px", marginTop: 14,
                background: "rgba(239,68,68,0.07)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 12, fontSize: 13, color: "#f87171",
              }}>
                ⚠ Failed for {r.token.slice(0, 12)}…: {r.error}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!hasRun && (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            border: "1px dashed #27272a", borderRadius: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚔️</div>
            <p style={{ fontSize: 15, color: "#52525b" }}>
              Enter at least 2 token addresses and tap <strong style={{ color: "#8b5cf6" }}>Compare</strong> to see which is most ready for Solana.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
