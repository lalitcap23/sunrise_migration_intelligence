"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import PageShell from "@/components/PageShell";
import Card from "@/components/Card";
import ScoreRing from "@/components/ScoreRing";
import ScoreBar from "@/components/ScoreBar";
import Badge from "@/components/Badge";

/* ─── Types ─────────────────────────────────────────────────────────── */

type ExchangeListing = {
  name: string; identifier: string; type: "dex" | "cex";
  pair: string; volumeUsd: number; trustScore: string | null; url: string | null;
};
type ExchangeListingsData = {
  dexListings: ExchangeListing[]; cexListings: ExchangeListing[];
  totalDexCount: number; totalCexCount: number;
  totalVolumeUsd: number; topVenueName: string | null; dataNote: string;
};

type FlagSeverity = "critical" | "warning" | "info";
interface CompatibilityFlag {
  id: string; label: string; severity: FlagSeverity; detected: boolean;
  description: string; bridgeImpact: string;
}
interface CompatibilityResult {
  contractName: string; isVerified: boolean; isProxy: boolean;
  implementationAddress: string | null; flags: CompatibilityFlag[];
  overallCompatibility: "compatible" | "caution" | "incompatible";
  compatibilityScore: number; summary: string; bridgeRecommendation: string;
}

type SlippageTier = {
  tradeSizeUsd: number; label: string; slippagePct: number | null;
  riskLevel: "Low" | "Moderate" | "High" | "Very High" | "N/A";
};

interface AnalysisResult {
  token: {
    address: string; chain: string; name: string; symbol: string;
    image: string | null; currentPrice: number; marketCap: number;
    circulatingSupply: number; totalSupply: number; platforms: Record<string, string>;
  };
  scores: {
    demand: number; marketPresence: number; liquidity: number;
    bridgeRisk: number; dumpRisk: number; overall: number;
  };
  modules: {
    demand: { score: number; breakdown: Record<string, string | number> };
    marketPresence: {
      score: number; breakdown: Record<string, string | number>;
      holderData: {
        uniqueRecipients: number; top10TransferPct: number;
        top10Addresses: { address: string; pct: number }[];
        totalTransfersAnalyzed: number; supported: boolean; dataNote: string;
      };
    };
    liquidity: {
      score: number; breakdown: Record<string, string | number>;
      slippage: SlippageTier[]; slippageNote: string;
      sim: {
        hasTvlData: boolean; note: string; seededTvlUsd: number;
        currentChain: { label: string; tvlUsd: number; slippageTiers: SlippageTier[]; depth1PctUsd: number; depth5PctUsd: number };
        solana: { label: string; tvlUsd: number; slippageTiers: SlippageTier[]; depth1PctUsd: number; depth5PctUsd: number };
        recommendation: { minLpUsd: number; targetLpUsd: number; rationale: string };
      };
      poolData: {
        totalPoolTvlUsd: number; poolCount: number;
        topPools: { name: string; tvlUsd: number; chain: string }[];
        priceConfidence: string; dataNote: string;
      };
    };
    bridgeRisk: {
      score: number; breakdown: Record<string, string | number>;
      bridges: {
        name: string; supported: boolean; estimatedCost: string;
        finalityMin: number; dataSource: string;
        wormhole: {
          availableNotionalUsd: number | null; dailyLimitUsd: number | null;
          maxSingleTxUsd: number | null; capacityPct: number | null;
          congestion: "Low" | "Moderate" | "High" | "Unknown";
        } | null;
      }[];
      dataNote: string;
    };
    dumpRisk: { score: number; breakdown: Record<string, string | number> };
    strategy: { strategy: string; rationale: string };
    overall: number;
  };
  chart: { volumeHistory: { date: string; volumeUsd: number }[] };
  exchanges: ExchangeListingsData;
}

/* ─── Utility functions ──────────────────────────────────────────────── */

const CHAINS = [
  { id: "ethereum", label: "Ethereum", icon: "Ξ" },
  { id: "polygon", label: "Polygon", icon: "⬡" },
] as const;

const fmtNum = (n: number) => {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

const RISK_COLORS: Record<string, { text: string; bg: string }> = {
  Low: { text: "text-green-400", bg: "bg-green-500/10" },
  Moderate: { text: "text-lime-400", bg: "bg-lime-500/10" },
  High: { text: "text-amber-400", bg: "bg-amber-500/10" },
  "Very High": { text: "text-red-400", bg: "bg-red-500/10" },
  "N/A": { text: "text-zinc-500", bg: "bg-zinc-500/10" },
};

/* ─── Sub-components ─────────────────────────────────────────────────── */

function BreakdownTable({ breakdown }: { breakdown: Record<string, string | number> }) {
  return (
    <div className="divide-y divide-white/[0.04]">
      {Object.entries(breakdown).map(([key, value]) => (
        <div key={key} className="flex justify-between items-center py-3">
          <span className="text-sm text-zinc-400">{key}</span>
          <span className="text-sm font-medium text-zinc-200 font-mono">
            {typeof value === "number" ? value.toLocaleString() : value}
          </span>
        </div>
      ))}
    </div>
  );
}

function SlippageTable({ tiers, title, tvlUsd, depth1, depth5 }: {
  tiers: SlippageTier[]; title: string; tvlUsd: number; depth1: number; depth5: number;
}) {
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-3">
        <p className="text-sm font-semibold text-zinc-200">{title}</p>
        <span className="text-xs text-zinc-600">TVL: {tvlUsd > 0 ? fmtNum(tvlUsd) : "N/A"}</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="py-2.5 px-4 text-left text-xs text-zinc-500 font-medium">Trade Size</th>
              <th className="py-2.5 px-4 text-right text-xs text-zinc-500 font-medium">Impact</th>
              <th className="py-2.5 px-4 text-right text-xs text-zinc-500 font-medium">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {tiers.map((t) => {
              const colors = RISK_COLORS[t.riskLevel] ?? RISK_COLORS["N/A"];
              return (
                <tr key={t.label}>
                  <td className="py-2.5 px-4 text-zinc-300 font-mono text-xs">{t.label}</td>
                  <td className={`py-2.5 px-4 text-right font-mono text-xs font-semibold ${t.slippagePct != null ? colors.text : "text-zinc-600"}`}>
                    {t.slippagePct != null ? `~${t.slippagePct < 0.001 ? "<0.001" : t.slippagePct}%` : "N/A"}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${colors.text} ${colors.bg}`}>
                      {t.riskLevel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tvlUsd > 0 && (
        <div className="flex gap-3 mt-3">
          <div className="flex-1 rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">1% Depth</p>
            <p className="text-sm font-bold text-zinc-200">{fmtNum(depth1)}</p>
          </div>
          <div className="flex-1 rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">5% Depth</p>
            <p className="text-sm font-bold text-zinc-200">{fmtNum(depth5)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function LiquiditySimPanel({ sim }: { sim: AnalysisResult["modules"]["liquidity"]["sim"] }) {
  return (
    <div className="mt-6 pt-6 border-t border-white/[0.06]">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-lg bg-gradient-to-r from-violet-500 to-cyan-400 bg-clip-text text-transparent">◎</span>
        <h4 className="text-sm font-bold text-zinc-200">Solana Migration Simulation</h4>
        <Badge variant="violet">CPMM</Badge>
      </div>

      {!sim.hasTvlData ? (
        <div className="p-4 rounded-xl bg-red-500/[0.06] border border-red-500/20 text-red-400 text-sm">⚠ {sim.note}</div>
      ) : (
        <>
          <SlippageTable
            title={`${sim.currentChain.label} — Current DEX Slippage`}
            tiers={sim.currentChain.slippageTiers} tvlUsd={sim.currentChain.tvlUsd}
            depth1={sim.currentChain.depth1PctUsd} depth5={sim.currentChain.depth5PctUsd}
          />
          <div className="p-[2px] rounded-2xl bg-gradient-to-br from-violet-500/40 to-cyan-400/40 mb-5">
            <div className="bg-[#0a0a10] rounded-[14px] p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">◎</span>
                <p className="text-xs text-zinc-400">
                  Estimates a new Raydium/Orca pool seeded with{" "}
                  <strong className="text-violet-400">{fmtNum(sim.seededTvlUsd)}</strong> (10% of current TVL)
                </p>
              </div>
              <SlippageTable
                title={sim.solana.label} tiers={sim.solana.slippageTiers}
                tvlUsd={sim.solana.tvlUsd} depth1={sim.solana.depth1PctUsd} depth5={sim.solana.depth5PctUsd}
              />
            </div>
          </div>
          <div className="p-4 rounded-xl bg-green-500/[0.05] border border-green-500/20 mb-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-3">LP Seed Recommendation</p>
            <div className="flex gap-4 flex-wrap">
              <div>
                <p className="text-[10px] text-zinc-500 mb-0.5">Min (for $10K trades &lt;1%)</p>
                <p className="text-lg font-bold text-green-400">{fmtNum(sim.recommendation.minLpUsd)}</p>
              </div>
              <div className="w-px bg-white/[0.06]" />
              <div>
                <p className="text-[10px] text-zinc-500 mb-0.5">Target (for $100K trades &lt;1%)</p>
                <p className="text-lg font-bold text-green-400">{fmtNum(sim.recommendation.targetLpUsd)}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-3 leading-relaxed">{sim.recommendation.rationale}</p>
          </div>
        </>
      )}
      <p className="text-[11px] text-zinc-600 leading-relaxed">ℹ {sim.note}</p>
    </div>
  );
}

function CompatibilityPanel({ token, chain }: { token: string; chain: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setStatus("loading");
    fetch("/api/compatibility", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, chain }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) { setErrMsg(data.error || "Check failed"); setStatus("error"); return; }
        setResult(data as CompatibilityResult);
        setStatus("done");
        if (data.flags?.some((f: CompatibilityFlag) => f.detected)) setOpen(true);
      })
      .catch(() => { setErrMsg("Network error"); setStatus("error"); });
  }, [token, chain]);

  const detectedFlags = result?.flags.filter((f) => f.detected) ?? [];
  const criticalCount = detectedFlags.filter((f) => f.severity === "critical").length;
  const warningCount = detectedFlags.filter((f) => f.severity === "warning").length;

  const compatStyles = result
    ? result.overallCompatibility === "compatible"
      ? { border: "border-green-500/25", bg: "bg-green-500/[0.04]", color: "text-green-400" }
      : result.overallCompatibility === "caution"
        ? { border: "border-amber-500/25", bg: "bg-amber-500/[0.04]", color: "text-amber-400" }
        : { border: "border-red-500/25", bg: "bg-red-500/[0.04]", color: "text-red-400" }
    : { border: "border-white/[0.06]", bg: "bg-[#0d0d14]/80", color: "text-zinc-400" };

  return (
    <div className={`rounded-2xl border ${compatStyles.border} ${compatStyles.bg} overflow-hidden mb-6`}>
      <div
        onClick={() => status === "done" && setOpen((o) => !o)}
        className={`flex items-center gap-3 p-5 ${status === "done" ? "cursor-pointer" : ""} select-none`}
      >
        <span className="text-xl">🔍</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-zinc-200">Contract Safety Scan</span>
            {status === "loading" && <span className="text-[11px] text-zinc-600">scanning…</span>}
            {status === "done" && result && (
              <Badge variant={result.overallCompatibility === "compatible" ? "green" : result.overallCompatibility === "caution" ? "amber" : "red"}>
                {result.overallCompatibility}
              </Badge>
            )}
          </div>
          {status === "done" && result && (
            <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
              {result.contractName !== "Unknown" && <span className="text-zinc-400">{result.contractName}</span>}
              <span>{result.isVerified ? "✓ Verified" : "⚠ Unverified"}</span>
              {result.isProxy && <span>· Proxy</span>}
              {criticalCount > 0 && <span className="text-red-400">· {criticalCount} critical</span>}
              {warningCount > 0 && <span className="text-amber-400">· {warningCount} warning{warningCount > 1 ? "s" : ""}</span>}
            </div>
          )}
          {status === "error" && <div className="text-xs text-red-400 mt-1">⚠ {errMsg}</div>}
        </div>
        {status === "done" && result && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className={`text-2xl font-bold ${compatStyles.color}`}>{result.compatibilityScore}</div>
              <div className="text-[10px] text-zinc-600">/ 100</div>
            </div>
            <span className="text-zinc-600 text-xs">{open ? "▲" : "▼"}</span>
          </div>
        )}
      </div>

      {open && status === "done" && result && (
        <div className="px-5 pb-5 border-t border-white/[0.04]">
          <p className="text-xs text-zinc-400 leading-relaxed mt-4 mb-3">{result.summary}</p>
          <div className="space-y-2 mb-4">
            {result.flags.map((flag) => (
              <div key={flag.id} className={`flex gap-3 p-3 rounded-xl border transition-all ${
                flag.detected
                  ? flag.severity === "critical" ? "bg-red-500/[0.04] border-red-500/20"
                    : flag.severity === "warning" ? "bg-amber-500/[0.04] border-amber-500/20"
                      : "bg-zinc-500/[0.04] border-zinc-500/20"
                  : "bg-white/[0.01] border-transparent opacity-40"
              }`}>
                <span className="text-sm flex-shrink-0">
                  {flag.detected ? (flag.severity === "critical" ? "🔴" : flag.severity === "warning" ? "🟡" : "🔵") : "✅"}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold ${
                      flag.detected
                        ? flag.severity === "critical" ? "text-red-400" : flag.severity === "warning" ? "text-amber-400" : "text-zinc-400"
                        : "text-zinc-600"
                    }`}>{flag.label}</span>
                    {flag.detected && (
                      <Badge variant={flag.severity === "critical" ? "red" : flag.severity === "warning" ? "amber" : "zinc"}>
                        {flag.severity}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{flag.description}</p>
                  {flag.detected && (
                    <p className={`text-[11px] mt-1 ${
                      flag.severity === "critical" ? "text-red-400/80" : flag.severity === "warning" ? "text-amber-400/80" : "text-zinc-400"
                    }`}>Bridge impact: {flag.bridgeImpact}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 rounded-xl bg-violet-500/[0.06] border border-violet-500/20">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">Bridge Recommendation</p>
            <p className="text-xs text-zinc-400 leading-relaxed">{result.bridgeRecommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ExchangePanel({ data }: { data: ExchangeListingsData }) {
  const [tab, setTab] = useState<"cex" | "dex">("cex");
  const list = tab === "cex" ? data.cexListings : data.dexListings;
  const maxVol = Math.max(...list.map((e) => e.volumeUsd), 1);

  return (
    <Card className="mb-6" padding={false}>
      <div className="p-5 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏛️</span>
            <span className="font-bold text-sm text-zinc-200">Exchange Listings</span>
          </div>
          <div className="flex gap-2">
            {data.totalCexCount > 0 && <Badge variant="cyan">{data.totalCexCount} CEX</Badge>}
            {data.totalDexCount > 0 && <Badge variant="violet">{data.totalDexCount} DEX</Badge>}
          </div>
        </div>
        <p className="text-xs text-zinc-600 mb-4">
          Total 24h: <span className="text-zinc-400 font-semibold">{fmtNum(data.totalVolumeUsd)}</span>
          {data.topVenueName && <> · Top: <span className="text-zinc-400 font-semibold">{data.topVenueName}</span></>}
        </p>
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1 w-fit">
          {(["cex", "dex"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                tab === t
                  ? t === "cex" ? "bg-cyan-500/15 text-cyan-400" : "bg-violet-500/15 text-violet-400"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}>
              {t === "cex" ? `CEX (${data.totalCexCount})` : `DEX (${data.totalDexCount})`}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 divide-y divide-white/[0.03]">
        {list.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-600">No {tab.toUpperCase()} listings found.</p>
        ) : (
          list.slice(0, 12).map((e, i) => {
            const pct = (e.volumeUsd / maxVol) * 100;
            return (
              <div key={e.identifier + i}
                className="relative flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 pointer-events-none transition-all duration-500"
                  style={{ width: `${pct}%`, background: tab === "cex" ? "rgba(34,211,238,0.04)" : "rgba(139,92,246,0.04)" }} />
                <span className="text-[11px] font-bold text-zinc-700 w-5 text-right relative z-10">{i + 1}</span>
                {tab === "cex" && e.trustScore && (
                  <span className={`w-2 h-2 rounded-full relative z-10 ${
                    e.trustScore === "green" ? "bg-green-400" : e.trustScore === "yellow" ? "bg-amber-400" : "bg-red-400"
                  }`} />
                )}
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="text-sm font-semibold text-zinc-200 truncate">{e.name}</div>
                  <div className="text-[11px] text-zinc-600">{e.pair}</div>
                </div>
                <div className="text-right relative z-10">
                  <div className={`text-sm font-semibold ${tab === "cex" ? "text-cyan-400" : "text-violet-400"}`}>{fmtNum(e.volumeUsd)}</div>
                  <div className="text-[10px] text-zinc-700">24h vol</div>
                </div>
                {e.url && (
                  <a href={e.url} target="_blank" rel="noopener noreferrer"
                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold relative z-10 border no-underline ${
                      tab === "cex" ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" : "text-violet-400 bg-violet-500/10 border-violet-500/20"
                    }`}>Trade ↗</a>
                )}
              </div>
            );
          })
        )}
        {list.length > 12 && (
          <p className="py-2.5 text-center text-[11px] text-zinc-700">+{list.length - 12} more</p>
        )}
      </div>
      <div className="p-4 border-t border-white/[0.04]">
        <p className="text-[11px] text-zinc-700">{data.dataNote}</p>
      </div>
    </Card>
  );
}

function DetailSection({ title, score, children, danger = false }: {
  title: string; score: number; children: React.ReactNode; danger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const scoreClasses = danger
    ? (score >= 70 ? "text-red-400 bg-red-500/15" : score >= 50 ? "text-orange-400 bg-orange-500/15" : score >= 30 ? "text-amber-400 bg-amber-500/15" : "text-green-400 bg-green-500/15")
    : (score >= 70 ? "text-green-400 bg-green-500/15" : score >= 40 ? "text-amber-400 bg-amber-500/15" : "text-red-400 bg-red-500/15");

  return (
    <div className={`rounded-2xl border ${danger && score >= 60 ? "border-red-500/20" : "border-white/[0.06]"} bg-[#0d0d14]/80 overflow-hidden mb-4`}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors cursor-pointer">
        <span className="text-sm font-semibold text-zinc-200">{title}</span>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${scoreClasses}`}>{score}/100</span>
          <span className="text-zinc-600 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && <div className="px-5 pb-5 border-t border-white/[0.04] pt-4">{children}</div>}
    </div>
  );
}

/* ─── Volume Chart ───────────────────────────────────────────────────── */

function VolumeChart({ data }: { data: { date: string; volumeUsd: number }[] }) {
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    volume: Math.round(d.volumeUsd),
  }));

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-200">30-Day Volume</h3>
        <Badge variant="cyan">Daily</Badge>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => v >= 1e9 ? `${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : `${v}`} />
            <Tooltip
              contentStyle={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12, color: "#e5e5e5" }}
              formatter={(value) => [fmtNum(Number(value ?? 0)), "Volume"]}
              labelStyle={{ color: "#71717a" }}
            />
            <Area type="monotone" dataKey="volume" stroke="#8b5cf6" strokeWidth={2} fill="url(#volGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ─── Score Overview ─────────────────────────────────────────────────── */

function ScoreOverview({ scores }: { scores: AnalysisResult["scores"] }) {
  const categories = [
    { key: "demand" as const, label: "Demand", icon: "📊" },
    { key: "marketPresence" as const, label: "Presence", icon: "👥" },
    { key: "liquidity" as const, label: "Liquidity", icon: "⚡" },
    { key: "bridgeRisk" as const, label: "Bridge", icon: "🔁" },
  ];

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-zinc-200">Score Overview</h3>
        <Badge variant="violet">Migration Readiness</Badge>
      </div>
      <div className="flex flex-col items-center mb-6">
        <ScoreRing score={scores.overall} size={120} strokeWidth={8} label="Overall" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {categories.map(({ key, label, icon }) => {
          const s = scores[key];
          const color = s >= 70 ? "text-green-400" : s >= 40 ? "text-amber-400" : "text-red-400";
          const bg = s >= 70 ? "bg-green-500/[0.06]" : s >= 40 ? "bg-amber-500/[0.06]" : "bg-red-500/[0.06]";
          return (
            <div key={key} className={`rounded-xl p-3 text-center ${bg} border border-white/[0.04]`}>
              <span className="text-base">{icon}</span>
              <div className={`text-xl font-bold mt-1 ${color} font-mono`}>{s}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{label}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl p-3 bg-red-500/[0.04] border border-white/[0.04]">
        <div className="flex items-center gap-2">
          <span>⚠️</span>
          <span className="text-xs text-zinc-400">Dump Risk</span>
        </div>
        <span className={`text-lg font-bold font-mono ${
          scores.dumpRisk >= 70 ? "text-red-400" : scores.dumpRisk >= 40 ? "text-amber-400" : "text-green-400"
        }`}>{scores.dumpRisk}</span>
      </div>
    </Card>
  );
}

/* ─── Holder Chart ───────────────────────────────────────────────────── */

function HolderChart({ holderData }: { holderData: AnalysisResult["modules"]["marketPresence"]["holderData"] }) {
  if (!holderData.supported || holderData.top10Addresses.length === 0) return null;

  const chartData = holderData.top10Addresses.map((a) => ({
    label: `${a.address.slice(0, 6)}…`,
    pct: a.pct,
  }));

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-zinc-300 mb-3">Top Holder Concentration</p>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#52525b", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11, color: "#e5e5e5" }}
              formatter={(value) => [`${Number(value ?? 0).toFixed(2)}%`, "Share"]}
            />
            <Bar dataKey="pct" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-zinc-500">
        <span>Recipients: <strong className="text-zinc-400">{holderData.uniqueRecipients.toLocaleString()}</strong></span>
        <span>Top 10: <strong className="text-zinc-400">{holderData.top10TransferPct.toFixed(1)}%</strong></span>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */

export default function AnalyzePage() {
  const [token, setToken] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzed, setAnalyzed] = useState<{ token: string; chain: string } | null>(null);
  const [ipfsStatus, setIpfsStatus] = useState<"idle" | "pinning" | "done" | "error">("idle");
  const [ipfsCid, setIpfsCid] = useState<string | null>(null);
  const [ipfsError, setIpfsError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token"); const c = params.get("chain");
    if (t) setToken(t); if (c) setChain(c);
  }, []);

  async function saveToIPFS() {
    if (!result) return;
    setIpfsStatus("pinning"); setIpfsError("");
    try {
      const res = await fetch("/api/ipfs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenName: result.token.name, tokenSymbol: result.token.symbol,
          contractAddress: result.token.address, chain: result.token.chain,
          analyzedAt: new Date().toISOString(), scores: result.scores,
          modules: result.modules, exchanges: result.exchanges, chart: result.chart,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setIpfsStatus("error"); setIpfsError(data.error ?? "Pin failed"); return; }
      setIpfsCid(data.cid); setIpfsStatus("done");
      try {
        const existing = JSON.parse(localStorage.getItem("sunrise_reports") ?? "[]");
        existing.push({
          cid: data.cid, tokenName: result.token.name, tokenSymbol: result.token.symbol,
          contractAddress: result.token.address, chain: result.token.chain,
          overall: result.scores.overall, strategy: result.modules.strategy.strategy,
          savedAt: new Date().toISOString(), gateway: data.gateway,
        });
        localStorage.setItem("sunrise_reports", JSON.stringify(existing));
      } catch {}
    } catch { setIpfsStatus("error"); setIpfsError("Network error — check PINATA_JWT"); }
  }

  async function handleRun() {
    if (!token.startsWith("0x") || token.length !== 42) { setError("Enter a valid contract address (0x… 42 chars)."); return; }
    setError(""); setRunning(true); setResult(null);
    setIpfsStatus("idle"); setIpfsCid(null); setIpfsError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, chain }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Analysis failed."); return; }
      setResult(data); setAnalyzed({ token, chain });
    } catch { setError("Network error. Check your connection."); }
    finally { setRunning(false); }
  }

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Analyze Token</h1>
            <Badge variant="violet">Migration Readiness</Badge>
          </div>
          <p className="text-zinc-500 text-sm max-w-lg">
            Enter a contract address and select the source chain. The analyzer evaluates demand, liquidity, bridge risk, and holder distribution in real time.
          </p>
        </div>

        {/* Input Form */}
        <Card className="mb-8 border-violet-500/20" glow="violet">
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Contract Address
          </label>
          <input
            type="text" value={token}
            onChange={(e) => { setToken(e.target.value); setError(""); }}
            placeholder="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
            disabled={running}
            className="w-full px-4 py-3.5 text-sm font-mono bg-[#050508] border border-white/[0.08] rounded-xl
                       text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10
                       transition-all disabled:opacity-50"
          />
          {error && (
            <p className="text-xs text-red-400 mt-2 flex items-center gap-1.5">
              <span>⚠</span> {error}
            </p>
          )}

          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mt-5 mb-2">
            Source Chain
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CHAINS.map((c) => {
              const active = chain === c.id;
              return (
                <button key={c.id} onClick={() => !running && setChain(c.id)} disabled={running}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer
                    ${active
                      ? "bg-violet-500/10 border-violet-500/30 text-white shadow-sm"
                      : "bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                    } disabled:opacity-50`}
                >
                  <span className="text-base">{c.icon}</span>
                  <span className="hidden sm:inline">{c.label}</span>
                  <span className="sm:hidden">{c.label.slice(0, 3)}</span>
                </button>
              );
            })}
          </div>

          <button onClick={handleRun} disabled={running || !token}
            className={`mt-6 w-full py-3.5 rounded-xl text-sm font-bold transition-all cursor-pointer
              ${running || !token
                ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                : "bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
              }`}
          >
            {running ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⟳</span> Analyzing…
              </span>
            ) : "Run Analysis"}
          </button>
        </Card>

        {/* Loading */}
        {running && (
          <Card className="text-center mb-8">
            <div className="text-5xl mb-4 animate-pulse">⏳</div>
            <p className="text-sm text-zinc-400">Fetching data from CoinGecko, Etherscan, and DeFiLlama...</p>
            <div className="flex justify-center gap-3 mt-6 flex-wrap">
              {["Market Data", "Holders", "Liquidity", "Bridge Routes"].map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                  <span className="text-[11px] text-zinc-600">{s}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div>
            {/* Token Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6 rounded-2xl
                           bg-gradient-to-r from-violet-500/[0.08] to-cyan-500/[0.04]
                           border border-violet-500/20 mb-6">
              <div className="flex items-center gap-4 flex-1">
                {result.token.image && (
                  <img src={result.token.image} alt={result.token.symbol}
                    className="w-14 h-14 rounded-xl bg-[#18181b] ring-2 ring-white/[0.06]" />
                )}
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {result.token.name} <span className="text-zinc-500 font-normal">({result.token.symbol})</span>
                  </h2>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    {fmtNum(result.token.currentPrice)} · MCap: {fmtNum(result.token.marketCap)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`text-4xl font-bold font-mono ${
                    result.scores.overall >= 70 ? "text-green-400" : result.scores.overall >= 40 ? "text-amber-400" : "text-red-400"
                  }`}>{result.scores.overall}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Overall Score</div>
                </div>
                {ipfsStatus === "idle" && (
                  <button onClick={saveToIPFS}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                              bg-amber-500/10 border border-amber-500/30 text-amber-400
                              text-xs font-bold hover:bg-amber-500/20 transition-all cursor-pointer whitespace-nowrap">
                    📌 Save to IPFS
                  </button>
                )}
                {ipfsStatus === "pinning" && <span className="text-xs text-amber-400 animate-pulse">⏳ Pinning…</span>}
                {ipfsStatus === "done" && ipfsCid && (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] text-green-400">✓ Pinned</span>
                    <code className="text-[10px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">{ipfsCid.slice(0, 12)}…{ipfsCid.slice(-6)}</code>
                    <Link href="/reports" className="text-[11px] text-amber-400 hover:underline">View Reports →</Link>
                  </div>
                )}
                {ipfsStatus === "error" && <span className="text-[11px] text-red-400 max-w-[140px] text-right">⚠ {ipfsError}</span>}
              </div>
            </div>

            {/* Score overview + Volume grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <ScoreOverview scores={result.scores} />
              {result.chart.volumeHistory.length > 0 && <VolumeChart data={result.chart.volumeHistory} />}
            </div>

            {/* Strategy */}
            <Card className="mb-6 border-green-500/20 bg-green-500/[0.04]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📈</span>
                <h3 className="text-base font-bold text-green-400">{result.modules.strategy.strategy}</h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{result.modules.strategy.rationale}</p>
            </Card>

            {/* Score Bars */}
            <Card className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-200 mb-4">Detailed Scores</h3>
              <ScoreBar score={result.scores.demand} label="Market Demand" />
              <ScoreBar score={result.scores.marketPresence} label="Market Presence" />
              <ScoreBar score={result.scores.liquidity} label="Liquidity" />
              <ScoreBar score={result.scores.bridgeRisk} label="Bridge Risk" />
              <ScoreBar score={result.scores.dumpRisk} label="Dump Risk" invert />
            </Card>

            {/* Contract Safety */}
            {analyzed && <CompatibilityPanel key={analyzed.token + analyzed.chain} token={analyzed.token} chain={analyzed.chain} />}

            {/* Exchanges */}
            {result.exchanges && <ExchangePanel data={result.exchanges} />}

            {/* Module Breakdowns */}
            <DetailSection title="📊 Market Demand Breakdown" score={result.modules.demand.score}>
              <BreakdownTable breakdown={result.modules.demand.breakdown} />
            </DetailSection>

            <DetailSection title="👥 Market Presence Breakdown" score={result.modules.marketPresence.score}>
              <BreakdownTable breakdown={result.modules.marketPresence.breakdown} />
              <HolderChart holderData={result.modules.marketPresence.holderData} />
            </DetailSection>

            <DetailSection title="⚡ Liquidity Breakdown" score={result.modules.liquidity.score}>
              <BreakdownTable breakdown={result.modules.liquidity.breakdown} />
              {result.modules.liquidity.poolData.topPools.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-xs font-semibold text-zinc-300 mb-2">
                    Top Pools ({result.modules.liquidity.poolData.poolCount} total · TVL: {fmtNum(result.modules.liquidity.poolData.totalPoolTvlUsd)})
                  </p>
                  <div className="space-y-1.5">
                    {result.modules.liquidity.poolData.topPools.slice(0, 5).map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-zinc-400">{p.name} <span className="text-zinc-600">({p.chain})</span></span>
                        <span className="text-zinc-300 font-mono">{fmtNum(p.tvlUsd)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.modules.liquidity.sim && <LiquiditySimPanel sim={result.modules.liquidity.sim} />}
            </DetailSection>

            <DetailSection title="🔁 Bridge Risk Breakdown" score={result.modules.bridgeRisk.score}>
              <BreakdownTable breakdown={result.modules.bridgeRisk.breakdown} />
              {result.modules.bridgeRisk.bridges.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                  {result.modules.bridgeRisk.bridges.map((bridge, i) => (
                    <div key={i} className={`p-4 rounded-xl border ${
                      bridge.supported ? "bg-green-500/[0.04] border-green-500/20" : "bg-red-500/[0.04] border-red-500/20"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-semibold ${bridge.supported ? "text-green-400" : "text-red-400"}`}>
                          {bridge.supported ? "✓" : "✗"} {bridge.name}
                        </span>
                        {bridge.wormhole?.congestion && (
                          <Badge variant={bridge.wormhole.congestion === "Low" ? "green" : bridge.wormhole.congestion === "High" ? "red" : "amber"}>
                            {bridge.wormhole.congestion}
                          </Badge>
                        )}
                      </div>
                      {bridge.supported && (
                        <div className="space-y-1 text-xs text-zinc-500">
                          <div>Cost: <span className="text-zinc-300">{bridge.estimatedCost}</span></div>
                          <div>Finality: <span className="text-zinc-300">{bridge.finalityMin} min</span></div>
                          {bridge.wormhole?.maxSingleTxUsd && (
                            <div>Max tx: <span className="text-zinc-300">{fmtNum(bridge.wormhole.maxSingleTxUsd)}</span></div>
                          )}
                        </div>
                      )}
                      <div className="text-[10px] text-zinc-700 mt-2">{bridge.dataSource}</div>
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>

            <DetailSection title="⚠ Dump Risk Analysis" score={result.modules.dumpRisk.score} danger>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                Higher score = higher risk. Signals whale concentration, supply unlock pressure, and speculative momentum.
              </p>
              <BreakdownTable breakdown={result.modules.dumpRisk.breakdown} />
            </DetailSection>

            <div className="text-center mt-10">
              <button onClick={() => { setResult(null); setToken(""); setAnalyzed(null); }}
                className="px-6 py-3 rounded-xl border border-white/[0.08] text-sm text-zinc-400
                          hover:border-violet-500/30 hover:text-violet-400 transition-all cursor-pointer">
                Analyze Another Token
              </button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
