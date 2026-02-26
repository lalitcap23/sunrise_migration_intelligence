import { runLiquiditySim, type LiquiditySimResult } from "./liquidity-sim";
export type { LiquiditySimResult };

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MIGRATION READINESS SCORING ENGINE
 *
 * This file owns ALL scoring logic for the Migration Readiness Analyzer.
 * The API route (app/api/analyze/route.ts) only fetches raw data; it then
 * passes that data into the functions here to produce scores.
 *
 * WHY a separate file
 *  - You can unit-test every scoring function in isolation (no HTTP needed).
 *  - When you add a new data source (e.g. Moralis for real holder counts),
 *    you only change the inputs here — the route stays the same.
 *  - Score weights and thresholds are in one visible place (SCORE_WEIGHTS).
 *
 * HOW SCORING WORKS (overview)
 * ─────────────────────────────
 * Each module returns a score 0–100 and a human-readable breakdown object.
 * The breakdown is shown directly in the UI — no magic numbers, full transparency.
 *
 * Final "Overall" score = weighted average of all module scores.
 * Weights are defined in SCORE_WEIGHTS below and follow industry convention
 * for evaluating DeFi token migration viability.
 *
 * MODULE OVERVIEW
 * ───────────────
 * Module 1: Market Demand       — CoinGecko (live done)
 * Module 2: Market Presence     — CoinGecko community proxy (live done )
 *                                 FUTURE: Moralis/Alchemy for real holder count
 * Module 3: Liquidity Profile   — CoinGecko tickers + volume (live done )
 *                                 FUTURE: DeFiLlama TVL API for deeper pool data
 * Module 4: Bridge Risk         — Static hardcode (live done)
 *                                 FUTURE: Wormhole API + LayerZero API for real quotes
 * Module 5: Migration Strategy  — Derived from modules 1–4 (live done)
 * Module 6: Overall Score       — Weighted average (live done)
 */

// ─── Shared types ─────────────────────────────────────────────────────────────

/**
 * Every scoring module returns this shape.
 * `breakdown` keys are label strings → displayed in the UI table.
 */
export type ScoreResult = {
  score: number; // 0–100, integer
  breakdown: Record<string, string | number>;
};

/**
 * Slippage estimate for a specific trade size.
 * Computed using the AMM constant-product formula:
 *   slippagePct = (tradeSize / (2 × totalPoolTvlUsd)) × 100
 * This is accurate for Uniswap v2-style pools and a reasonable approximation
 * for concentrated liquidity pools at normal market conditions.
 */
export type SlippageEstimate = {
  tradeSizeUsd: number;             // reference trade size in USD
  label: string;                    // display label e.g. "$100K"
  slippagePct: number | null;       // null when TVL data unavailable
  riskLevel: "Low" | "Moderate" | "High" | "Very High" | "N/A";
};

/** Extended result type for the liquidity module — includes slippage estimates and Solana sim. */
export type LiquidityScoreResult = ScoreResult & {
  slippage: SlippageEstimate[];     // AMM slippage for 4 reference trade sizes
  slippageNote: string;             // human-readable data source note
  sim: LiquiditySimResult;          // Solana post-migration CPMM simulation
};


/** Combined scores object passed between functions. */
export type AllScores = {
  demand: number;
  marketPresence: number;
  liquidity: number;
  bridgeRisk: number;
  dumpRisk: number;
};

export type StrategyResult = {
  strategy: string;
  rationale: string;
};

export type DumpRiskInput = {
  top10TransferPct: number;
  holderDataAvailable: boolean;
  circulatingSupply: number;
  totalSupply: number;
  priceChange7d: number;
  priceChange30d: number;
  volume24h: number;
  marketCap: number;
};

// ─── Official score weights ───────────────────────────────────────────────────
//
// These weights are based on the project specification in contexts.md.
// Demand and Liquidity carry the most weight because they are the primary
// indicators of whether a Solana listing will have healthy initial trading.
// Bridge risk is downweighted because all major chains have viable routes.
//
export const SCORE_WEIGHTS = {
  demand: 0.30,        // 30% — is there real trading interest?
  marketPresence: 0.25, // 25% — how distributed / community-backed is it?
  liquidity: 0.30,     // 30% — can traders actually buy/sell without slippage?
  bridgeRisk: 0.15,    // 15% — can it be moved safely and cheaply?
} as const;

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Clamps a number to [min, max] and rounds to an integer.
 * Used by every scoring function to keep outputs in the 0–100 range.
 */
export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

// ─── Module 1: Market Demand Score ───────────────────────────────────────────
//
// DATA SOURCE: CoinGecko `coins/contract/:address` (live)
//
// WHY THESE METRICS?
//  - Vol/MCap ratio is the industry-standard "turnover ratio" for a token.
//    Anything above 5% signals active, organic trading.
//    Source: CMC / CoinGecko analyst guides, DeFi Pulse methodology.
//  - Market cap rank signals broad awareness (top 100 → more likely adoption).
//  - 7d + 30d price trend shows momentum — rising tokens have pull-through demand.
//
// SCORING BREAKDOWN (100 pts total):
//  ┌──────────────────────┬────────┬────────────────────────────────────────┐
//  │ Sub-metric           │ Max pts│ Logic                                  │
//  ├──────────────────────┼────────┼────────────────────────────────────────┤
//  │ Vol/MCap ratio       │  40    │ volMcapRatio * 5 (capped at 40)        │
//  │ Market cap rank      │  30    │ 30 - rank*0.3  (rank 1 = 30, rank 100 = 0) │
//  │ Price trend 7d+30d   │  30    │ 15 + weighted change (clamped 0–30)    │
//  └──────────────────────┴────────┴────────────────────────────────────────┘
//

export type DemandInput = {
  volume24h: number;    // from market_data.total_volume.usd
  marketCap: number;    // from market_data.market_cap.usd
  marketCapRank: number | null; // from market_data.market_cap_rank
  priceChange7d: number;  // from market_data.price_change_percentage_7d
  priceChange30d: number; // from market_data.price_change_percentage_30d
};

export function calcDemandScore(data: DemandInput): ScoreResult {
  const volMcapRatio =
    data.marketCap > 0 ? (data.volume24h / data.marketCap) * 100 : 0;

  // Sub-score A: turnover ratio (0–40 pts)
  const volScore = clamp(volMcapRatio * 5, 0, 40);

  // Sub-score B: market cap rank (0–30 pts). No rank data → 10 pts default.
  const rankScore = data.marketCapRank
    ? clamp(Math.max(0, 30 - data.marketCapRank * 0.3), 0, 30)
    : 10;

  // Sub-score C: price trend (0–30 pts). Neutral baseline = 15.
  const trendScore = clamp(
    15 + (data.priceChange7d * 0.5 + data.priceChange30d * 0.3),
    0,
    30,
  );

  return {
    score: clamp(volScore + rankScore + trendScore),
    breakdown: {
      "24h Volume (USD)": `$${(data.volume24h / 1e6).toFixed(2)}M`,
      "Vol/MCap Ratio": `${volMcapRatio.toFixed(2)}%`,
      "Market Cap Rank": data.marketCapRank ?? "N/A",
      "7d Price Change": `${data.priceChange7d.toFixed(2)}%`,
      "30d Price Change": `${data.priceChange30d.toFixed(2)}%`,
    },
  };
}

// ─── Module 2: Market Presence Score ─────────────────────────────────────────
//
// DATA SOURCE: Etherscan V2 (free) + CoinGecko tickers
//
// REAL DATA NOW LIVE:
//  - uniqueRecipients   → count of unique wallets that received tokens in the
//                         last 1000 transfers (Etherscan account/tokentx, free)
//  - top10TransferPct   → % of recent transfer volume going to top 10 wallets
//                         (computed in lib/holders.ts, Etherscan free tier)
//  - tickerCount        → # of exchanges listing the token (CoinGecko tickers)
//  - watchlistUsers     → CoinGecko portfolio watchers (supplementary signal)
//
// WHY THESE METRICS?
//  - uniqueRecipients: More unique recent recipients = more distributed ownership.
//    Low count signals low adoption or controlled circulation.
//  - top10TransferPct: The classic "whale concentration" metric.
//    Industry benchmark (Chainalysis): >50% in top 10 = high centralization risk.
//    Source: Chainalysis 2022 DeFi Report; CoinMetrics token distribution research.
//  - tickerCount: Exchange breadth reflects how accessible the token is globally.
//
// SCORING BREAKDOWN (100 pts total):
//  ┌──────────────────────────┬────────┬─────────────────────────────────────┐
//  │ Sub-metric               │ Max pts│ Logic                               │
//  ├──────────────────────────┼────────┼─────────────────────────────────────┤
//  │ Unique recent recipients │  40    │ log10(count) * 13 (capped at 40)    │
//  │ Top-10 concentration     │  40    │ 40 − top10Pct*0.8 (lower = better)  │
//  │ Exchange breadth         │  20    │ tickerCount * 0.4 (capped at 20)    │
//  └──────────────────────────┴────────┴─────────────────────────────────────┘
//
// CONCENTRATION BENCHMARKS (industry standard):
//  top10Pct < 20%  → Very distributed (40 pts)
//  top10Pct 20-40% → Healthy          (24–40 pts)
//  top10Pct 40-60% → Moderate risk    (8–24 pts)
//  top10Pct > 60%  → High risk        (0–8 pts)
//
// FALLBACK: If holder data is unavailable (BSC without BscScan key, or API error),
//  top10TransferPct defaults to 0 and uniqueRecipients to 0 → neutral score of ~20.
//

export type MarketPresenceInput = {
  // From Etherscan (lib/holders.ts)
  uniqueRecipients: number;   // unique wallets receiving tokens in last 1000 txs
  top10TransferPct: number;   // % of transfer volume going to top 10 wallets (0–100)
  holderDataAvailable: boolean; // false = BSC without key, or API failed

  // From CoinGecko (always available)
  tickerCount: number;        // number of exchange listings
  watchlistUsers: number;     // CoinGecko portfolio watchers (supplementary)
};

export function calcMarketPresenceScore(data: MarketPresenceInput): ScoreResult {
  // Sub-score A: unique recent recipients (log scale)
  // log10(1)=0 → 0pts | log10(100)=2 → 26pts | log10(1000)=3 → 39pts | 1000+ → 40pts
  const recipientScore = data.holderDataAvailable
    ? clamp(Math.log10(data.uniqueRecipients + 1) * 13, 0, 40)
    : 20; // neutral fallback when data unavailable

  // Sub-score B: top-10 concentration (INVERSE — lower concentration = higher score)
  // top10Pct=0%  → 40pts | top10Pct=50% → 0pts | top10Pct=100% → 0pts
  const concentrationScore = data.holderDataAvailable
    ? clamp(40 - data.top10TransferPct * 0.8, 0, 40)
    : 20; // neutral fallback

  // Sub-score C: exchange breadth (CoinGecko tickers — always available)
  const exchangeScore = clamp(data.tickerCount * 0.4, 0, 20);

  const score = clamp(recipientScore + concentrationScore + exchangeScore);

  // Classify concentration risk for the UI
  const concentrationRisk =
    !data.holderDataAvailable ? "Unknown (chain not supported)"
      : data.top10TransferPct < 20 ? "Low — well distributed"
        : data.top10TransferPct < 40 ? "Moderate — healthy"
          : data.top10TransferPct < 60 ? "Elevated — some concentration"
            : "High — top wallets dominate";

  return {
    score,
    breakdown: {
      "Unique Recent Recipients": data.uniqueRecipients.toLocaleString(),
      "Top-10 Transfer Concentration": data.holderDataAvailable
        ? `${data.top10TransferPct.toFixed(1)}%`
        : "N/A",
      "Concentration Risk": concentrationRisk,
      "Exchange Listings": data.tickerCount,
      "Watchlist Users (CG)": data.watchlistUsers.toLocaleString(),
      "Data Source": data.holderDataAvailable
        ? "Etherscan V2 (last 1000 transfers)"
        : "Etherscan not available for this chain",
    },
  };
}

// ─── Module 3: Liquidity Profile Score ───────────────────────────────────────
//
// DATA SOURCE: DeFiLlama (free, no key) — PRIMARY
//              CoinGecko market_data + tickers — SECONDARY / FALLBACK
//
// REAL DATA NOW LIVE:
//  - totalPoolTvlUsd  → sum of TVL across ALL DEX pools holding this token
//                       (DeFiLlama yields/pools, filtered by underlyingTokens)
//  - poolCount        → number of distinct pools (more = more accessible)
//  - priceConfidence  → DeFiLlama confidence score 0–1 (how consistently
//                       the price is quoted across oracles and CEXes)
//  - tickerCount      → CoinGecko exchange listings (always available)
//  - spread           → 24h high/low spread from CoinGecko (always available)
//
// WHY THESE METRICS?
//  - totalPoolTvlUsd directly answers contexts.md: "Total liquidity on all
//    major venues". This is the industry-standard metric used by DeFi Pulse,
//    DeFiLlama rankings, and Messari reports.
//  - priceConfidence: DeFiLlama assigns this based on how many sources agree
//    on the price. Low confidence = token is thinly traded / unreliable data.
//  - Spread proxy: still useful as a secondary signal for CEX order book depth.
//
// SCORING BREAKDOWN (100 pts total):
//  ┌──────────────────────────┬────────┬───────────────────────────────────────┐
//  │ Sub-metric               │ Max pts│ Logic                                 │
//  ├──────────────────────────┼────────┼───────────────────────────────────────┤
//  │ Pool TVL (DeFiLlama)     │  50    │ log10(tvl+1)*10 (capped at 50)        │
//  │                          │        │ <$1M=0 | $1M=30 | $100M=44 | $1B=50  │
//  ├──────────────────────────┼────────┼───────────────────────────────────────┤
//  │ Price confidence         │  20    │ confidence * 20 (0.99 → 19.8 pts)    │
//  ├──────────────────────────┼────────┼───────────────────────────────────────┤
//  │ Exchange listings (CG)   │  15    │ tickerCount * 0.15 (capped at 15)    │
//  ├──────────────────────────┼────────┼───────────────────────────────────────┤
//  │ Price spread proxy (CG)  │  15    │ 15 − spread*1.5 (tighter = better)   │
//  └──────────────────────────┴────────┴───────────────────────────────────────┘
//
// FALLBACK: If DeFiLlama is unavailable (totalPoolTvlUsd=0, poolCount=0),
//  the TVL and confidence scores default to the CoinGecko Vol/MCap proxy
//  to ensure the overall analysis still returns a valid score.
//

export type LiquidityInput = {
  // From DeFiLlama (lib/liquidity.ts) — primary
  totalPoolTvlUsd: number;   // total TVL in USD across all pools
  poolCount: number;         // number of pools holding this token
  priceConfidence: number;   // 0–1 confidence from DeFiLlama

  // From CoinGecko — secondary / always available
  volume24h: number;   // market_data.total_volume.usd (fallback signal)
  marketCap: number;   // market_data.market_cap.usd   (fallback signal)
  currentPrice: number; // market_data.current_price.usd (for CPMM pool reserve derivation)
  tickerCount: number; // tickers[].length
  high24h: number;     // market_data.high_24h.usd
  low24h: number;      // market_data.low_24h.usd
  chain: string;       // source chain — passed through to sim for bridge cost lookup
};

// Reference trade sizes used for AMM slippage estimation
const SLIPPAGE_TRADE_SIZES: { usd: number; label: string }[] = [
  { usd: 1_000, label: "$1K" },
  { usd: 10_000, label: "$10K" },
  { usd: 100_000, label: "$100K" },
  { usd: 1_000_000, label: "$1M" },
];

export function calcLiquidityScore(data: LiquidityInput): LiquidityScoreResult {
  // Sub-score A: Real pool TVL from DeFiLlama (primary — 0–50 pts)
  // log10 scale: $0=0 | $1M≈30 | $10M≈40 | $100M≈44 | $1B≈50
  // Falls back to Vol/MCap ratio if no DeFiLlama data (tvl=0, poolCount=0)
  const hasTvlData = data.totalPoolTvlUsd > 0;
  const tvlScore = hasTvlData
    ? clamp(Math.log10(data.totalPoolTvlUsd + 1) * 10, 0, 50)
    : clamp(
      // Fallback: Vol/MCap ratio proxy (same logic as before DeFiLlama)
      data.marketCap > 0
        ? (data.volume24h / data.marketCap) * 100 * 5
        : 0,
      0,
      50,
    );

  // Sub-score B: DeFiLlama price confidence (0–20 pts)
  const confidenceScore = clamp(data.priceConfidence * 20, 0, 20);

  // Sub-score C: Exchange listing breadth from CoinGecko (0–15 pts)
  const exchangeScore = clamp(data.tickerCount * 0.15, 0, 15);

  // Sub-score D: 24h price spread proxy from CoinGecko (0–15 pts)
  const spread =
    data.high24h > 0
      ? ((data.high24h - data.low24h) / data.high24h) * 100
      : 10;
  const spreadScore = clamp(15 - spread * 1.5, 0, 15);

  // TVL label for UI
  const tvlLabel = data.totalPoolTvlUsd >= 1e9
    ? `$${(data.totalPoolTvlUsd / 1e9).toFixed(2)}B`
    : data.totalPoolTvlUsd >= 1e6
      ? `$${(data.totalPoolTvlUsd / 1e6).toFixed(2)}M`
      : `$${(data.totalPoolTvlUsd / 1e3).toFixed(1)}K`;

  // ── AMM Slippage Estimation (Option 1 — DeFiLlama TVL) ──────────────────────
  //
  // Formula:  slippage% = tradeSize / (2 × totalPoolTvlUsd) × 100
  //
  // Derivation: For a constant-product AMM (x*y=k), price impact for a trade
  // of size Δx into a pool of depth L (≈ TVL/2 per side) is:
  //   impact ≈ Δx / L = tradeSize / (TVL/2) = tradeSize / (2 × TVL) × 100
  //
  // This is a lower-bound estimate (underestimates real slippage for
  // concentrated liquidity pools outside the active tick range).
  // It works well as a migration risk signal — if even this lower bound
  // is high, the token has dangerously thin liquidity.
  //
  // Risk thresholds (industry convention, Uniswap/Messari research):
  //   < 0.1%  → Low      (deep liquidity, institutional-grade)
  //   0.1–1%  → Moderate (healthy retail liquidity)
  //   1–5%    → High     (thin — significant price impact)
  //   > 5%    → Very High (illiquid — migration is costly)
  //
  const slippage: SlippageEstimate[] = SLIPPAGE_TRADE_SIZES.map(({ usd, label }) => {
    if (!hasTvlData || data.totalPoolTvlUsd === 0) {
      return { tradeSizeUsd: usd, label, slippagePct: null, riskLevel: "N/A" as const };
    }
    const pct = (usd / (2 * data.totalPoolTvlUsd)) * 100;
    const riskLevel =
      pct < 0.1 ? "Low" as const
        : pct < 1 ? "Moderate" as const
          : pct < 5 ? "High" as const
            : "Very High" as const;
    return {
      tradeSizeUsd: usd,
      label,
      slippagePct: parseFloat(pct.toFixed(4)),
      riskLevel,
    };
  });

  const slippageNote = hasTvlData
    ? `AMM formula: tradeSize / (2 × ${tvlLabel} TVL). Lower-bound estimate for constant-product pools.`
    : "Slippage unavailable — no DeFiLlama TVL data for this token.";

  // ── Solana post-migration simulation ────────────────────────────────────────
  const sim = runLiquiditySim(data.totalPoolTvlUsd, data.currentPrice, data.chain);

  return {
    score: clamp(tvlScore + confidenceScore + exchangeScore + spreadScore),
    breakdown: {
      "Total Pool TVL": hasTvlData ? tvlLabel : "N/A (using proxy)",
      "DEX Pool Count": data.poolCount,
      "Price Confidence": data.priceConfidence > 0
        ? `${(data.priceConfidence * 100).toFixed(0)}%` : "N/A",
      "Exchange Listings (CG)": data.tickerCount,
      "24h Price Spread": `${spread.toFixed(2)}%`,
      "Slippage $1K trade": slippage[0]?.slippagePct != null ? `~${slippage[0].slippagePct}% (${slippage[0].riskLevel})` : "N/A",
      "Slippage $10K trade": slippage[1]?.slippagePct != null ? `~${slippage[1].slippagePct}% (${slippage[1].riskLevel})` : "N/A",
      "Slippage $100K trade": slippage[2]?.slippagePct != null ? `~${slippage[2].slippagePct}% (${slippage[2].riskLevel})` : "N/A",
      "Slippage $1M trade": slippage[3]?.slippagePct != null ? `~${slippage[3].slippagePct}% (${slippage[3].riskLevel})` : "N/A",
      "Data Source": hasTvlData ? "DeFiLlama (real TVL)" : "CoinGecko proxy",
    },
    slippage,
    slippageNote,
    sim,
  };
}


// ─── Module 4b: Dump Risk Score ──────────────────────────────────────────────
//
// Measures the probability that large holders will sell/dump the token shortly
// after migration, destabilizing the new Solana listing.
//
// Sub-scores (100 pts total):
//  ┌──────────────────────────┬────────┬─────────────────────────────────────────┐
//  │ Whale concentration      │  35    │ INVERSE: 35 − top10Pct*0.35             │
//  │ Supply unlock risk       │  25    │ circ/total ratio → higher = safer       │
//  │ Price momentum (bearish) │  25    │ INVERSE: negative trend → higher risk   │
//  │ Vol/MCap churn           │  15    │ INVERSE: very high ratio = speculative  │
//  └──────────────────────────┴────────┴─────────────────────────────────────────┘
//
// NOTE: Higher dump risk score = HIGHER danger. 0 = safe, 100 = extreme risk.
//

export function calcDumpRiskScore(data: DumpRiskInput): ScoreResult {
  // Sub-score A: Whale concentration risk (35 pts max)
  // High top-10 pct means a few wallets could dump and crater the price.
  const whaleRisk = data.holderDataAvailable
    ? clamp(data.top10TransferPct * 0.35, 0, 35)
    : 17; // neutral fallback

  // Sub-score B: Supply unlock risk (25 pts max)
  // Low circ/total ratio means a large locked supply can unlock post-migration.
  const supplyRatio =
    data.totalSupply > 0 ? data.circulatingSupply / data.totalSupply : 1;
  const supplyRisk = clamp((1 - supplyRatio) * 25, 0, 25);

  // Sub-score C: Price momentum risk (25 pts max)
  // Bearish 7d + 30d trend signals existing sell pressure.
  const momentumRisk = clamp(
    12.5 + (-data.priceChange7d * 0.3 + -data.priceChange30d * 0.2),
    0,
    25,
  );

  // Sub-score D: High-churn speculation risk (15 pts max)
  // Vol/MCap > 20% daily indicates hot-money speculation, not organic demand.
  const volMcapRatio =
    data.marketCap > 0 ? (data.volume24h / data.marketCap) * 100 : 0;
  const churnRisk = clamp(volMcapRatio * 0.5, 0, 15);

  const totalRisk = clamp(whaleRisk + supplyRisk + momentumRisk + churnRisk);

  const riskLabel =
    totalRisk >= 70 ? "🔴 Extreme"
      : totalRisk >= 50 ? "🟠 High"
        : totalRisk >= 30 ? "🟡 Moderate"
          : "🟢 Low";

  const supplyPct = (supplyRatio * 100).toFixed(1);

  return {
    score: totalRisk,
    breakdown: {
      "Risk Level": riskLabel,
      "Whale Concentration Risk": data.holderDataAvailable
        ? `${data.top10TransferPct.toFixed(1)}% to top-10 wallets`
        : "N/A (data unavailable)",
      "Circulating / Total Supply": `${supplyPct}%`,
      "7d Price Momentum": `${data.priceChange7d.toFixed(2)}%`,
      "30d Price Momentum": `${data.priceChange30d.toFixed(2)}%`,
      "Vol / MCap (daily churn)": `${volMcapRatio.toFixed(2)}%`,
    },
  };
}

// ─── Module 5: Migration Strategy Recommendation ─────────────────────────────
//
// Purely derived — no external data needed.
// Decision tree based on the composite scores from modules 1–4.
//
// Strategy options (from contexts.md spec):
//  1. Canonical Token Launch   — native SPL token, direct liquidity migration
//  2. LP-Based Migration       — seed Orca/Raydium pool first
//  3. Liquidity Bootstrapping  — LBP event for price discovery
//  4. Wrapped Token            — lowest barrier, lowest commitment
//

export function recommendStrategy(scores: AllScores): StrategyResult {
  const avg =
    scores.demand * SCORE_WEIGHTS.demand +
    scores.marketPresence * SCORE_WEIGHTS.marketPresence +
    scores.liquidity * SCORE_WEIGHTS.liquidity +
    scores.bridgeRisk * SCORE_WEIGHTS.bridgeRisk;

  if (avg >= 70 && scores.dumpRisk < 50) {
    return {
      strategy: "Canonical Token Launch",
      rationale:
        "Strong demand, deep liquidity, and broad market presence. " +
        "Launch a native SPL token and migrate liquidity directly via Wormhole or CCIP.",
    };
  }
  if (avg >= 55) {
    return {
      strategy: "LP-Based Migration",
      rationale:
        "Moderate scores across the board. " +
        "Seed a concentrated liquidity pool on Orca or Raydium to bootstrap trading before full migration.",
    };
  }
  if (scores.liquidity < 40) {
    return {
      strategy: "Liquidity Bootstrapping Event (LBP)",
      rationale:
        "Liquidity on the source chain is thin. " +
        "Use a Liquidity Bootstrapping Pool on Fjord or Meteora to establish fair price discovery before launch.",
    };
  }
  if (scores.dumpRisk >= 70) {
    return {
      strategy: "Wrapped Token",
      rationale:
        "Dump risk is extreme — whale concentration or bearish momentum signals major sell pressure post-migration. " +
        "Use a wrapped token while working on community distribution.",
    };
  }
  return {
    strategy: "Wrapped Token",
    rationale:
      "Overall readiness is below threshold. " +
      "Start with a wrapped representation (e.g. via Wormhole) while building community and liquidity on Solana.",
  };
}

// ─── Module 6: Overall Readiness Score ───────────────────────────────────────
//
// Weighted average using SCORE_WEIGHTS constants above.
// This is the "gut check" number displayed prominently in the UI.
//

export function calcOverallScore(scores: AllScores): number {
  return clamp(
    scores.demand * SCORE_WEIGHTS.demand +
    scores.marketPresence * SCORE_WEIGHTS.marketPresence +
    scores.liquidity * SCORE_WEIGHTS.liquidity +
    scores.bridgeRisk * SCORE_WEIGHTS.bridgeRisk,
  );
}

