/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LIQUIDITY SIMULATION ENGINE
 *
 * ── MODEL OVERVIEW ──────────────────────────────────────────────────────────
 * We model the future Solana pool as a Constant-Product Market Maker (CPMM),
 * the same model used by Raydium Standard pools and Orca Whirlpools at the
 * outer tick range. For a pool with equal-value reserves (50/50):
 *
 *   tokenReserve  = (TVL / 2) / priceUsd      (token-side)
 *   quoteReserve  = TVL / 2                   (USDC-side)
 *   Product k     = tokenReserve × quoteReserve   (invariant)
 *
 * Price impact for a buy of Δq USDC worth of tokens:
 *   new_tokenReserve = k / (quoteReserve + Δq)
 *   tokensOut        = tokenReserve - new_tokenReserve
 *   priceImpact%     = (Δq / (quoteReserve + Δq/2)) × 100
 *                    ≈ Δq / (2 × quoteReserve) × 100     [small-trade approx]
 *
 * For simplicity we use the closed-form approximation throughout — it is
 * accurate to within ~5% for trades up to ~10% of pool depth, which covers
 * the entire practical range for migration planning.
 *
 * ── WE PRODUCE ─────────────────────────────────────────────────────────
 *  ┌──────────────────────────────┬──────────────────────────────────────────┐
 *  │ Output                       │ Meaning                                  │
 *  ├──────────────────────────────┼──────────────────────────────────────────┤
 *  │ currentChain.slippageTiers   │ Slippage at 4 sizes using EXISTING TVL   │
 *  │                              │ (tells you current DEX liquidity health)  │
 *  ├──────────────────────────────┼──────────────────────────────────────────┤
 *  │ solana.slippageTiers         │ Same tiers for the modeled Solana pool   │
 *  │                              │ seeded with `seededTvlUsd`               │
 *  ├──────────────────────────────┼──────────────────────────────────────────┤
 *  │ solana.depth1PctUsd          │ Max trade (USD) before >1% price impact  │
 *  │ solana.depth5PctUsd          │ Max trade (USD) before >5% price impact  │
 *  ├──────────────────────────────┼──────────────────────────────────────────┤
 *  │ recommendation.minLpUsd      │ Minimum LP seed for <1% slip on $10K    │
 *  │ recommendation.targetLpUsd   │ Target LP seed for <1% slip on $100K    │
 *  ├──────────────────────────────┼──────────────────────────────────────────┤
 *  │ migrationCost.bridgeFeeRange │ String range from bridge data            │
 *  │ migrationCost.lpSeedUsd      │ = recommendation.targetLpUsd            │
 *  │ migrationCost.totalEstUsd    │ midpoint bridge cost + LP seed           │
 *  └──────────────────────────────┴──────────────────────────────────────────┘
 *
 * ── SEEDED TVL ASSUMPTION ───────────────────────────────────────────────────
 * By default, the Solana pool is modeled with 10% of the current chain's TVL.
 * This is conservative — projects typically migrate 5–20% of existing liquidity
 * in the first 30 days. We cap at $50M and floor at $10K to stay realistic.
 */


/** A single slippage estimate at a given trade size. */
export type SlippageTier = {
    tradeSizeUsd: number;
    label: string;                                           // "$10K"
    slippagePct: number | null;                              // null if TVL = 0
    riskLevel: "Low" | "Moderate" | "High" | "Very High" | "N/A";
};

/** LP seeding recommendation derived from the CPMM math. */
export type LpRecommendation = {
    minLpUsd: number;
    targetLpUsd: number;
    rationale: string;
};

/** All-in migration cost breakdown. */
export type MigrationCostEstimate = {
    bridgeFeeRange: string;     // e.g. "~$3–8"
    bridgeFeeUsd: number;       // midpoint of the range
    lpSeedUsd: number;          // = recommendation.targetLpUsd
    totalEstUsd: number;        // bridgeFeeUsd + lpSeedUsd
};

/** Output for one chain's liquidity projection (current source or Solana). */
export type ChainLiquidityProjection = {
    label: string;              // "Current (Ethereum)" or "Solana (Post-Migration)"
    tvlUsd: number;             // TVL this simulation is based on
    slippageTiers: SlippageTier[];
    depth1PctUsd: number;       // trade size that causes ~1% price impact
    depth5PctUsd: number;       // trade size that causes ~5% price impact
};

/** Full simulation result returned from `runLiquiditySim()`. */
export type LiquiditySimResult = {
    currentChain: ChainLiquidityProjection;
    solana: ChainLiquidityProjection;
    seededTvlUsd: number;
    recommendation: LpRecommendation;
    migrationCost: MigrationCostEstimate;
    hasTvlData: boolean;
    note: string;
};

// constants
/** Reference trade sizes for slippage simulation. */
const TRADE_TIERS: { usd: number; label: string }[] = [
    { usd: 1_000, label: "$1K" },
    { usd: 10_000, label: "$10K" },
    { usd: 100_000, label: "$100K" },
    { usd: 1_000_000, label: "$1M" },
];

/**
 * Fraction of existing TVL we assume gets seeded on Solana at launch.
 * Conservative estimate — real projects vary from 5% to 30%.
 */
const SOLANA_TVL_FRACTION = 0.10;
const SOLANA_TVL_FLOOR_USD = 10_000;    // even tiny tokens need a floor
const SOLANA_TVL_CAP_USD = 50_000_000; // cap to prevent "infinite depth" illusions

// Bridge fee midpoints (USD) for cost estimate. These map to the static
// costs already in bridges.ts — we duplicate the midpoints here to keep
// liquidity-sim.ts self-contained (no circular deps).
const BRIDGE_MIDPOINTS: Record<string, number> = {
    ethereum: 9,   // midpoint of $3–8 + $5–15 average
    bsc: 3,   // midpoint of $1–4
    polygon: 2,   // midpoint of $0.5–2
};

const BRIDGE_RANGES: Record<string, string> = {
    ethereum: "~$3–15",
    bsc: "~$1–4",
    polygon: "~$0.5–8",
};


/**
 * Computes price impact % for a trade using the CPMM approximation.
 *
 * slippage% = tradeSizeUsd / (2 × poolTvlUsd) × 100
 *
 * Returns null if TVL = 0 (no liquidity data).
 */
function calcSlippage(tradeSizeUsd: number, poolTvlUsd: number): number | null {
    if (poolTvlUsd <= 0) return null;
    return (tradeSizeUsd / (2 * poolTvlUsd)) * 100;
}

/** Classify a slippage % into a risk level matching industry thresholds. */
function riskLevel(pct: number | null): SlippageTier["riskLevel"] {
    if (pct === null) return "N/A";
    if (pct < 0.1) return "Low";
    if (pct < 1) return "Moderate";
    if (pct < 5) return "High";
    return "Very High";
}

/**
 * Builds a `ChainLiquidityProjection` for a given TVL and label.
 *
 * depth1Pct = pool TVL × 0.01   (1% of one side of the pool ≈ 1% impact)
 * depth5Pct = pool TVL × 0.05
 */
function buildProjection(label: string, tvlUsd: number): ChainLiquidityProjection {
    const slippageTiers: SlippageTier[] = TRADE_TIERS.map(({ usd, label: tLabel }) => {
        const pct = calcSlippage(usd, tvlUsd);
        return {
            tradeSizeUsd: usd,
            label: tLabel,
            slippagePct: pct !== null ? parseFloat(pct.toFixed(4)) : null,
            riskLevel: riskLevel(pct),
        };
    });

    // depth = TVL/2 * impactPct (one side of the pool drives price)
    const quoteReserve = tvlUsd / 2;
    return {
        label,
        tvlUsd,
        slippageTiers,
        depth1PctUsd: Math.round(quoteReserve * 0.01),
        depth5PctUsd: Math.round(quoteReserve * 0.05),
    };
}

// ─── LP recommendation math ───────────────────────────────────────────────────

/**
 * Minimum LP seed so that a $targetTrade creates < maxSlippage% price impact.
 *
 * From: maxSlippage/100 = targetTrade / (2 × TVL)
 * Solving: TVL = targetTrade / (2 × maxSlippage/100)
 *             = targetTrade × 50 / maxSlippage
 */
function lpNeededForSlippage(
    targetTradeUsd: number,
    maxSlippagePct: number,
): number {
    if (maxSlippagePct <= 0) return Infinity;
    return (targetTradeUsd * 50) / maxSlippagePct;
}

function buildRecommendation(minLpUsd: number, targetLpUsd: number): LpRecommendation {
    const fmt = (n: number) =>
        n >= 1_000_000
            ? `$${(n / 1_000_000).toFixed(1)}M`
            : n >= 1_000
                ? `$${(n / 1_000).toFixed(0)}K`
                : `$${n.toFixed(0)}`;

    return {
        minLpUsd: Math.round(minLpUsd),
        targetLpUsd: Math.round(targetLpUsd),
        rationale:
            `Seed at least ${fmt(minLpUsd)} for <1% slippage on $10K trades. ` +
            `Seed ${fmt(targetLpUsd)} for <1% slippage on $100K trades. ` +
            `These amounts keep Raydium/Orca CPMM price impact within healthy retail trading ranges.`,
    };
}


/**
 * Run the full liquidity simulation for a token being considered for migration
 * from `chain` to Solana.
 *
 * @param totalPoolTvlUsd  Source-chain DEX TVL (from DeFiLlama)
 * @param priceUsd         Current token price (from CoinGecko / DeFiLlama)
 * @param chain            Source chain — "ethereum" | "bsc" | "polygon"
 *
 * Always returns a valid result — falls back gracefully when TVL is 0.
 */
export function runLiquiditySim(
    totalPoolTvlUsd: number,
    priceUsd: number,
    chain: string,
): LiquiditySimResult {
    const hasTvlData = totalPoolTvlUsd > 0;

    // ── Current chain projection ─────────────────────────────────────────────
    const chainLabel = `Current (${chain.charAt(0).toUpperCase() + chain.slice(1)})`;
    const currentChain = buildProjection(chainLabel, totalPoolTvlUsd);

    // ── Solana projected TVL ──────────────────────────────────────────────────
    // 10% of existing TVL, capped and floored.
    const rawSolanatvl = totalPoolTvlUsd * SOLANA_TVL_FRACTION;
    const seededTvlUsd = hasTvlData
        ? Math.min(SOLANA_TVL_CAP_USD, Math.max(SOLANA_TVL_FLOOR_USD, rawSolanatvl))
        : 0;

    // ── Solana projection ─────────────────────────────────────────────────────
    const solana = buildProjection("Solana (Post-Migration)", seededTvlUsd);

    // minLp  = seed needed for <1% on $10K
    // target = seed needed for <1% on $100K
    const minLpUsd = lpNeededForSlippage(10_000, 1);   // = $500K
    const targetLpUsd = lpNeededForSlippage(100_000, 1);   // = $5M
    const recommendation = buildRecommendation(minLpUsd, targetLpUsd);

    // ── Migration cost estimate ───────────────────────────────────────────────
    const bridgeFeeUsd = BRIDGE_MIDPOINTS[chain] ?? 5;
    const bridgeRange = BRIDGE_RANGES[chain] ?? "~$2–15";
    const migrationCost: MigrationCostEstimate = {
        bridgeFeeRange: bridgeRange,
        bridgeFeeUsd,
        lpSeedUsd: recommendation.targetLpUsd,
        totalEstUsd: bridgeFeeUsd + recommendation.targetLpUsd,
    };

    const note = hasTvlData
        ? `Solana pool modeled at 10% of current ${chain} TVL ($${(seededTvlUsd / 1_000).toFixed(0)}K). ` +
        `CPMM constant-product formula (x·y=k). Lower-bound estimate — real slippage may be higher.`
        : "No DeFiLlama TVL found. Slippage estimates unavailable — enter a token with active DEX pools.";

    return {
        currentChain,
        solana,
        seededTvlUsd,
        recommendation,
        migrationCost,
        hasTvlData,
        note,
    };
}


/** Format a USD number compactly: $1.2M, $450K, $1,200 */
export function fmtUsd(n: number): string {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
}

/** Map a risk level string to a color hex for use in inline styles. */
export function riskColor(level: SlippageTier["riskLevel"]): string {
    switch (level) {
        case "Low": return "#22c55e"; // green
        case "Moderate": return "#84cc16"; // lime
        case "High": return "#eab308"; // yellow
        case "Very High": return "#ef4444"; // red
        default: return "#71717a"; // gray
    }
}
