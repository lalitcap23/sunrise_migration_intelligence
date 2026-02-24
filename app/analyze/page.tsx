"use client";

import { useState } from "react";
import Link from "next/link";

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
      bridges: { name: string; supported: boolean }[];
    };
    strategy: { strategy: string; rationale: string };
    overall: number;
  };
  chart: {
    volumeHistory: { date: string; volumeUsd: number }[];
  };
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

export default function AnalyzePage() {
  const [token, setToken] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

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
        {/* Back link */}
        <Link href="/" style={{ 
          fontSize: 13, 
          color: "#8b5cf6", 
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          transition: "color 0.2s",
        }}>
          ← Back to home
        </Link>

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
                        <span
                          key={i}
                          style={{
                            fontSize: 12,
                            padding: "6px 14px",
                            borderRadius: 20,
                            background: bridge.supported ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: bridge.supported ? "#22c55e" : "#ef4444",
                            border: `1px solid ${bridge.supported ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                          }}
                        >
                          {bridge.name}: {bridge.supported ? "✓" : "✗"}
                        </span>
                      ))}
                    </div>
                  )}
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
