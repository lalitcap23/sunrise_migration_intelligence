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
  { id: "ethereum", label: "Ethereum",  short: "ETH",  accent: "#60a5fa", glow: "rgba(96,165,250,0.15)", icon: "Ξ" },
  { id: "bsc",      label: "BNB Chain", short: "BNB",  accent: "#fbbf24", glow: "rgba(251,191,36,0.12)",  icon: "⬡" },
  { id: "polygon",  label: "Polygon",   short: "MATIC", accent: "#c084fc", glow: "rgba(192,132,252,0.15)", icon: "⬡" },
];

function fmtPrice(n: number): string {
  if (n >= 1000)  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1)     return `$${n.toFixed(2)}`;
  if (n >= 0.001) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}
function fmtBig(n: number): string {
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${(n/1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

const MEDALS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"];

export default function TokensPage() {
  const [active,  setActive]  = useState("ethereum");
  const [tokens,  setTokens]  = useState<TopToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const chain = CHAINS.find(c => c.id === active)!;

  useEffect(() => {
    setLoading(true);
    setError("");
    setTokens([]);
    fetch(`/api/top-tokens?chain=${active}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok || d.error) { setError(d.error || "Failed"); return; }
        setTokens((d.tokens ?? []).slice(0, 10));
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [active]);

  const maxMcap = Math.max(...tokens.map(t => t.marketCap), 1);

  return (
    <div style={{ minHeight: "100vh", background: "#07070e", color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07070e; }
        .token-row { transition: background 0.12s; }
        .token-row:hover { background: rgba(255,255,255,0.03) !important; cursor: pointer; }
        .chain-btn { transition: all 0.2s; }
        .chain-btn:hover { transform: translateY(-1px); }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        .live-dot { animation: blink 2s infinite; }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 80px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
          <Link href="/" style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#475569", textDecoration: "none", letterSpacing: "0.05em" }}>
            ← BACK
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { href: "/compare",  label: "COMPARE", color: "#c084fc" },
              { href: "/analyze",  label: "ANALYZE",  color: "#38bdf8" },
              { href: "/reports",  label: "REPORTS",  color: "#fbbf24" },
            ].map(b => (
              <Link key={b.href} href={b.href} style={{
                fontFamily: "'IBM Plex Mono'", fontSize: 11, fontWeight: 600,
                color: b.color, textDecoration: "none", padding: "5px 14px",
                border: `1px solid ${b.color}40`, borderRadius: 4,
                background: `${b.color}0c`, letterSpacing: "0.08em",
              }}>{b.label}</Link>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontFamily: "'Syne'", fontSize: 32, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
              Chain Markets
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", border: "1px solid #38bdf830", borderRadius: 3, background: "#38bdf808" }}>
              <span className="live-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", display: "block" }} />
              <span style={{ fontSize: 9, color: "#4ade80", fontWeight: 600, letterSpacing: "0.1em" }}>LIVE</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#475569", letterSpacing: "0.03em" }}>
            Top 10 tokens by market cap — select chain to switch view
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 32 }}>
          {CHAINS.map(c => {
            const isActive = active === c.id;
            return (
              <button
                key={c.id}
                className="chain-btn"
                onClick={() => setActive(c.id)}
                style={{
                  padding: "18px 16px", borderRadius: 8, cursor: "pointer",
                  border: isActive ? `1px solid ${c.accent}60` : "1px solid rgba(255,255,255,0.06)",
                  background: isActive ? `${c.accent}0e` : "rgba(255,255,255,0.02)",
                  boxShadow: isActive ? `0 0 24px ${c.glow}` : "none",
                  textAlign: "center" as const,
                }}
              >
                <div style={{ fontFamily: "'Syne'", fontSize: 22, color: isActive ? c.accent : "#334155", marginBottom: 6, fontWeight: 800 }}>
                  {c.icon}
                </div>
                <div style={{ fontFamily: "'Syne'", fontSize: 14, fontWeight: 700, color: isActive ? "#ffffff" : "#475569", marginBottom: 4 }}>
                  {c.label}
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Mono'", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em",
                  color: isActive ? c.accent : "#1e293b",
                }}>
                  {c.short}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{
          border: `1px solid ${chain.accent}25`,
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: `0 0 48px ${chain.glow}`,
          background: "rgba(10,10,20,0.95)",
        }}>
          <div style={{
            padding: "14px 24px",
            borderBottom: `1px solid rgba(255,255,255,0.05)`,
            background: `linear-gradient(to right, ${chain.accent}08, transparent)`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 18, fontWeight: 700, color: chain.accent }}>{chain.icon}</span>
              <span style={{ fontFamily: "'Syne'", fontSize: 14, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.02em" }}>
                {chain.label.toUpperCase()} — TOP 10
              </span>
            </div>
            <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono'", color: "#334155", letterSpacing: "0.05em" }}>
              MCap · 24h · Vol
            </span>
          </div>

          <div style={{ padding: "6px 0" }}>
            {["#", "TOKEN", "", "PRICE", "24H", "MARKET CAP", "VOLUME"].map((h, i) => (
              <span key={i} />
            ))}
          </div>

          {loading && (
            <div style={{ padding: "60px 24px", textAlign: "center" }}>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "#334155", letterSpacing: "0.1em" }}>
                FETCHING DATA<span style={{ animation: "blink 1s infinite" }}>_</span>
              </div>
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: "40px 24px", textAlign: "center", fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "#f87171" }}>
              ERR: {error}
            </div>
          )}

          {!loading && !error && tokens.map((t, i) => {
            const up = t.priceChange24h >= 0;
            const pct = Math.abs(t.priceChange24h);
            const mcapPct = (t.marketCap / maxMcap) * 100;

            return (
              <div
                key={t.id}
                className="token-row"
                onClick={() => t.address && (window.location.href = `/analyze?token=${t.address}&chain=${active}`)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 44px 1fr 100px 80px 120px 110px",
                  alignItems: "center",
                  padding: "0 24px",
                  height: 60,
                  borderBottom: i < 9 ? "1px solid rgba(255,255,255,0.03)" : "none",
                  cursor: t.address ? "pointer" : "default",
                  animation: `fadeUp 0.3s ease both`,
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, fontWeight: 600, color: i < 3 ? chain.accent : "#1e293b", letterSpacing: "0.05em" }}>
                  {MEDALS[i]}
                </span>

                {t.image
                  ? <img src={t.image} alt="" style={{ width: 28, height: 28, borderRadius: "50%", background: "#0f0f1a" }} />
                  : <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${chain.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono'", fontSize: 9, fontWeight: 700, color: chain.accent }}>{t.symbol.slice(0,2)}</div>
                }

                <div style={{ paddingLeft: 10 }}>
                  <div style={{ fontFamily: "'Syne'", fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    {t.name}
                    {t.address && <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 8, color: chain.accent, border: `1px solid ${chain.accent}40`, padding: "1px 5px", borderRadius: 2 }}>ANALYZE</span>}
                  </div>
                  <div style={{ position: "relative", height: 3, background: "rgba(255,255,255,0.04)", borderRadius: 2, width: "min(120px, 100%)" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${mcapPct}%`, background: `linear-gradient(to right, ${chain.accent}60, ${chain.accent}30)`, borderRadius: 2 }} />
                  </div>
                </div>

                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 600, color: "#e2e8f0", textAlign: "right" as const }}>
                  {fmtPrice(t.currentPrice)}
                </div>

                <div style={{
                  fontFamily: "'IBM Plex Mono'", fontSize: 11, fontWeight: 600,
                  textAlign: "right" as const,
                  color: up ? "#4ade80" : "#f87171",
                }}>
                  {up ? "+" : "-"}{pct.toFixed(2)}%
                </div>

                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "#64748b", textAlign: "right" as const }}>
                  {fmtBig(t.marketCap)}
                </div>

                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "#334155", textAlign: "right" as const }}>
                  {fmtBig(t.volume24h)}
                </div>
              </div>
            );
          })}

          <div style={{
            padding: "12px 24px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: "#1e293b", letterSpacing: "0.05em" }}>
              SOURCE: COINGECKO API · CACHE: 5MIN
            </span>
            <Link href="/analyze" style={{
              fontFamily: "'IBM Plex Mono'", fontSize: 10, color: chain.accent,
              textDecoration: "none", letterSpacing: "0.08em", fontWeight: 600,
            }}>
              ANALYZE ANY TOKEN →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
