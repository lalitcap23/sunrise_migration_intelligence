"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type TopToken = {
  id:             string;
  symbol:         string;
  name:           string;
  image:          string;
  currentPrice:   number;
  marketCap:      number;
  volume24h:      number;
  priceChange24h: number;
  address:        string | null;
  rank:           number;
};

const CHAINS = [
  {
    id:     "ethereum",
    label:  "Ethereum",
    short:  "ETH",
    icon:   "Ξ",
    accent: "#627eea",
    glow:   "rgba(98,126,234,0.18)",
    bg:     "rgba(98,126,234,0.07)",
    border: "rgba(98,126,234,0.35)",
  },
  {
    id:     "bsc",
    label:  "BNB Chain",
    short:  "BNB",
    icon:   "⬡",
    accent: "#f0b90b",
    glow:   "rgba(240,185,11,0.15)",
    bg:     "rgba(240,185,11,0.06)",
    border: "rgba(240,185,11,0.35)",
  },
  {
    id:     "polygon",
    label:  "Polygon",
    short:  "MATIC",
    icon:   "⬡",
    accent: "#8247e5",
    glow:   "rgba(130,71,229,0.18)",
    bg:     "rgba(130,71,229,0.07)",
    border: "rgba(130,71,229,0.35)",
  },
];

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1)    return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function fmtBig(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default function TokensPage() {
  const [activeChain, setActiveChain] = useState("ethereum");
  const [tokens,      setTokens]      = useState<TopToken[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");

  const chain = CHAINS.find((c) => c.id === activeChain)!;

  useEffect(() => {
    setLoading(true);
    setError("");
    setTokens([]);
    fetch(`/api/top-tokens?chain=${activeChain}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) { setError(data.error || "Failed to load"); return; }
        setTokens((data.tokens ?? []).slice(0, 10));
      })
      .catch(() => setError("Network error — please try again."))
      .finally(() => setLoading(false));
  }, [activeChain]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #050508 0%, #0d0d14 50%, #050508 100%)",
      padding: "40px 20px 80px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <Link href="/" style={{ fontSize: 13, color: "#8b5cf6", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            ← Back
          </Link>
          <Link href="/analyze" style={{
            fontSize: 13, fontWeight: 600, color: "#b980ff", textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 8,
            border: "1px solid rgba(139,92,246,0.3)",
            background: "rgba(139,92,246,0.08)",
          }}>
            Analyze a Token →
          </Link>
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
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", display: "inline-block", animation: "pulse 2s infinite" }} />
            Live Data
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "#ffffff", margin: "0 0 10px", letterSpacing: "-0.5px" }}>
            Top Tokens by Chain
          </h1>
          <p style={{ fontSize: 15, color: "#52525b", margin: 0 }}>
            Pick a chain to see the top 10 tokens ranked by market cap
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 32,
        }}>
          {CHAINS.map((c) => {
            const active = activeChain === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveChain(c.id)}
                style={{
                  padding: "18px 12px",
                  borderRadius: 14,
                  border: active ? `2px solid ${c.accent}` : "2px solid rgba(255,255,255,0.06)",
                  background: active ? c.bg : "rgba(18,18,24,0.6)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: active ? `0 0 28px ${c.glow}` : "none",
                  transform: active ? "translateY(-2px)" : "none",
                  textAlign: "center" as const,
                }}
              >
                <div style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: active ? c.accent : "#3f3f46",
                  marginBottom: 6,
                  lineHeight: 1,
                }}>
                  {c.icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: active ? "#ffffff" : "#52525b" }}>
                  {c.label}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700, marginTop: 4,
                  padding: "2px 8px", borderRadius: 10,
                  display: "inline-block",
                  background: active ? `${c.accent}25` : "rgba(255,255,255,0.04)",
                  color: active ? c.accent : "#3f3f46",
                  letterSpacing: "0.5px",
                }}>
                  {c.short}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{
          background: "rgba(12,12,18,0.95)",
          border: `1px solid ${chain.border}`,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: `0 0 60px ${chain.glow}`,
          transition: "box-shadow 0.3s, border-color 0.3s",
        }}>
          <div style={{
            padding: "20px 24px",
            background: `linear-gradient(135deg, ${chain.bg}, transparent)`,
            borderBottom: `1px solid ${chain.border}40`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${chain.accent}20`,
                border: `1px solid ${chain.accent}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 800, color: chain.accent,
              }}>
                {chain.icon}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>
                  Top 10 on {chain.label}
                </div>
                <div style={{ fontSize: 11, color: "#52525b", marginTop: 2 }}>
                  Ranked by market capitalisation
                </div>
              </div>
            </div>
            <span style={{
              fontSize: 10, padding: "4px 10px", borderRadius: 20,
              background: `${chain.accent}18`, color: chain.accent,
              border: `1px solid ${chain.accent}35`,
              fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.6px",
            }}>
              LIVE
            </span>
          </div>

          {loading && (
            <div style={{ padding: "60px 24px", textAlign: "center" }}>
              <div style={{ display: "inline-flex", gap: 8, marginBottom: 16 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: chain.accent, display: "inline-block",
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#52525b" }}>
                Fetching top tokens on {chain.label}…
              </p>
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
              <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>{error}</p>
            </div>
          )}

          {!loading && !error && tokens.length > 0 && (
            <div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr 110px 110px 90px",
                gap: "0 8px",
                padding: "10px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
                {["#", "Token", "Price", "Market Cap", "24h"].map((h) => (
                  <span key={h} style={{
                    fontSize: 10, color: "#3f3f46", fontWeight: 700,
                    textTransform: "uppercase" as const, letterSpacing: "0.5px",
                    textAlign: h === "Price" || h === "Market Cap" || h === "24h" ? "right" as const : "left" as const,
                  }}>
                    {h}
                  </span>
                ))}
              </div>

              {tokens.map((t, i) => {
                const up = t.priceChange24h >= 0;
                const changeColor = up ? "#22c55e" : "#ef4444";
                const changeBg    = up ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)";

                return (
                  <div
                    key={t.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "44px 1fr 110px 110px 90px",
                      gap: "0 8px",
                      alignItems: "center",
                      padding: "14px 24px",
                      borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                      transition: "background 0.15s",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = `${chain.accent}06`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ textAlign: "center" as const }}>
                      {i < 3 ? (
                        <span style={{ fontSize: 18 }}>{MEDAL[i]}</span>
                      ) : (
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: "#3f3f46",
                          background: "rgba(255,255,255,0.04)",
                          width: 26, height: 26, borderRadius: 8,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {t.rank}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      {t.image ? (
                        <img
                          src={t.image}
                          alt={t.symbol}
                          style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: "#18181b" }}
                        />
                      ) : (
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                          background: `${chain.accent}20`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, color: chain.accent,
                        }}>
                          {t.symbol.slice(0, 2)}
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 600, color: "#e5e5e5",
                          whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {t.name}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5,
                            background: `${chain.accent}18`, color: chain.accent,
                            border: `1px solid ${chain.accent}30`,
                          }}>
                            {t.symbol}
                          </span>
                          {t.address && (
                            <Link
                              href={`/analyze?token=${t.address}&chain=${activeChain}`}
                              style={{
                                fontSize: 9, padding: "1px 6px", borderRadius: 5,
                                background: "rgba(139,92,246,0.12)", color: "#a78bfa",
                                border: "1px solid rgba(139,92,246,0.25)",
                                fontWeight: 700, textDecoration: "none",
                                textTransform: "uppercase" as const, letterSpacing: "0.3px",
                              }}
                            >
                              Analyze ↗
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" as const }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5" }}>
                        {fmtPrice(t.currentPrice)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" as const }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa" }}>
                        {fmtBig(t.marketCap)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" as const }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                        background: changeBg, color: changeColor,
                        display: "inline-block",
                      }}>
                        {up ? "▲" : "▼"} {Math.abs(t.priceChange24h).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}

              <div style={{
                padding: "14px 24px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 11, color: "#27272a" }}>
                  Source: CoinGecko · 5 min cache
                </span>
                <Link
                  href="/analyze"
                  style={{
                    fontSize: 12, fontWeight: 600, color: chain.accent, textDecoration: "none",
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "6px 14px", borderRadius: 8,
                    background: `${chain.accent}12`,
                    border: `1px solid ${chain.accent}30`,
                    transition: "all 0.2s",
                  }}
                >
                  Analyze any token →
                </Link>
              </div>
            </div>
          )}
        </div>
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
      `}</style>
    </div>
  );
}
