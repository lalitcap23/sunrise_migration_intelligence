/**
 * app/api/analyze/route.ts
 * POST /api/analyze
 *
 * This route is a THIN ORCHESTRATOR. Its only jobs are:
 *  1. Validate the incoming request
 *  2. Fetch raw data from CoinGecko (via lib/coingecko.ts)
 *  3. Pass raw numbers into the scoring engine (lib/scoring.ts)
 *  4. Return a clean, structured JSON response
 *
 * It contains ZERO scoring logic. All scoring lives in lib/scoring.ts.
 * This separation means you can test scoring independently with mock data.
 */

import { NextRequest, NextResponse } from "next/server";
import Coingecko from "@coingecko/coingecko-typescript";
import { geckoClient, PLATFORM_MAP } from "@/lib/coingecko";
import { fetchHolderData } from "@/lib/holders";
import { fetchLiquidityData } from "@/lib/liquidity";
import {
  calcDemandScore,
  calcMarketPresenceScore,
  calcLiquidityScore,
  calcBridgeScore,
  recommendStrategy,
  calcOverallScore,
} from "@/lib/scoring";

// ─── Request validation ───────────────────────────────────────────────────────

function isValidAddress(addr: string): boolean {
  return typeof addr === "string" && addr.startsWith("0x") && addr.length === 42;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Parse body
  let token: string;
  let chain: string;
  try {
    const body = await req.json();
    token = body.token?.trim() ?? "";
    chain = body.chain?.trim() ?? "ethereum";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // 2. Validate address
  if (!isValidAddress(token)) {
    return NextResponse.json(
      { error: "Invalid token address. Must be 0x… and 42 characters long." },
      { status: 400 },
    );
  }

  const platformId = PLATFORM_MAP[chain] ?? "ethereum";

  try {
    // ── Fetch all external data IN PARALLEL ──────────────────────────────────
    //   4 sources fire simultaneously — no serial waiting.
    //   CoinGecko (2 calls) + Etherscan + DeFiLlama all run at the same time.
    //   DeFiLlama yields/pools is cached 1hr server-side → fast after first hit.
    const [coinData, chartData, holderData, liquidityData] = await Promise.all([
      // CoinGecko: full coin metadata + market data by contract address
      geckoClient.coins.contract.get(token, { id: platformId }),

      // CoinGecko: 30-day market chart (volume + price history for charts)
      geckoClient.coins.contract.marketChart.get(token, {
        id: platformId,
        vs_currency: "usd",
        days: "30",
      }),

      // Etherscan V2: real holder concentration (never throws — safe fallback)
      fetchHolderData(token, chain),

      // DeFiLlama: real pool TVL + price confidence (never throws — safe fallback)
      fetchLiquidityData(token, chain),
    ]);

    // ── Step 3: Extract raw fields from CoinGecko response ───────────────────
    //   We cast to Record<string, number> because the SDK types these as
    //   unknown currency maps (e.g. { usd: 74000000000, btc: 1200 }).
    const md = coinData.market_data ?? {};
    const cd = coinData.community_data ?? {};

    const volume24h    = (md.total_volume as Record<string, number>)?.usd ?? 0;
    const marketCap    = (md.market_cap as Record<string, number>)?.usd ?? 0;
    const currentPrice = (md.current_price as Record<string, number>)?.usd ?? 0;
    const high24h      = (md.high_24h as Record<string, number>)?.usd ?? currentPrice * 1.05;
    const low24h       = (md.low_24h as Record<string, number>)?.usd ?? currentPrice * 0.95;

    const marketCapRank  = md.market_cap_rank ?? null;
    const priceChange7d  = md.price_change_percentage_7d ?? 0;
    const priceChange30d = md.price_change_percentage_30d ?? 0;
    const circulatingSupply = md.circulating_supply ?? 0;
    const totalSupply       = md.total_supply ?? circulatingSupply;

    const watchlistUsers = coinData.watchlist_portfolio_users ?? 0;
    const tickerCount    = (coinData.tickers ?? []).length;

    // ── Step 4: Run scoring engine ────────────────────────────────────────────
    //   All logic lives in lib/scoring.ts. Route only wires inputs → outputs.

    const demandResult = calcDemandScore({
      volume24h,
      marketCap,
      marketCapRank,
      priceChange7d,
      priceChange30d,
    });

    // Use real Etherscan holder data — holderData.supported=false means BSC
    // without a BscScan key, so the scoring function uses neutral defaults.
    const marketPresenceResult = calcMarketPresenceScore({
      uniqueRecipients:     holderData.uniqueRecipients,
      top10TransferPct:     holderData.top10TransferPct,
      holderDataAvailable:  holderData.supported && holderData.uniqueRecipients > 0,
      tickerCount,
      watchlistUsers,
    });

    // Real TVL from DeFiLlama as primary; CoinGecko signals as secondary/fallback
    const liquidityResult = calcLiquidityScore({
      totalPoolTvlUsd:   liquidityData.totalPoolTvlUsd,
      poolCount:         liquidityData.poolCount,
      priceConfidence:   liquidityData.priceConfidence,
      volume24h,
      marketCap,
      tickerCount,
      high24h,
      low24h,
    });

    const bridgeResult = calcBridgeScore(chain);

    const allScores = {
      demand:         demandResult.score,
      marketPresence: marketPresenceResult.score,
      liquidity:      liquidityResult.score,
      bridgeRisk:     bridgeResult.score,
    };

    const strategyResult = recommendStrategy(allScores);
    const overallScore   = calcOverallScore(allScores);

    // ── Step 5: Build 30-day volume history for charts ────────────────────────
    const volumeHistory = (chartData.total_volumes ?? []).map((entry: number[]) => ({
      date:      new Date(entry[0] ?? 0).toISOString().split("T")[0],
      volumeUsd: Math.round(entry[1] ?? 0),
    }));

    // ── Step 6: Return structured response ────────────────────────────────────
    return NextResponse.json({
      // Token identity
      token: {
        address:            token,
        chain,
        name:               coinData.name ?? "Unknown",
        symbol:             coinData.symbol?.toUpperCase() ?? "???",
        image:              (coinData.image as Record<string, string>)?.small ?? null,
        currentPrice,
        marketCap,
        circulatingSupply,
        totalSupply,
        // All chains where this token exists — useful for cross-chain context
        platforms: coinData.platforms ?? {},
      },

      // Top-level scores (for the summary card in the UI)
      scores: {
        demand:         demandResult.score,
        marketPresence: marketPresenceResult.score,
        liquidity:      liquidityResult.score,
        bridgeRisk:     bridgeResult.score,
        overall:        overallScore,
      },

      // Per-module detail (for the breakdown tables in the UI)
      modules: {
        demand: {
          score:     demandResult.score,
          breakdown: demandResult.breakdown,
        },
        marketPresence: {
          score:     marketPresenceResult.score,
          breakdown: marketPresenceResult.breakdown,
          // Raw Etherscan data for the UI (top holder list, etc.)
          holderData: {
            uniqueRecipients:         holderData.uniqueRecipients,
            top10TransferPct:         holderData.top10TransferPct,
            top10Addresses:           holderData.top10Addresses,
            totalTransfersAnalyzed:   holderData.totalTransfersAnalyzed,
            supported:                holderData.supported,
            dataNote:                 holderData.dataNote,
          },
        },
        liquidity: {
          score:     liquidityResult.score,
          breakdown: liquidityResult.breakdown,
          // Raw DeFiLlama data for the UI (top pool list, TVL, confidence)
          poolData: {
            totalPoolTvlUsd: liquidityData.totalPoolTvlUsd,
            poolCount:       liquidityData.poolCount,
            topPools:        liquidityData.topPools,
            priceConfidence: liquidityData.priceConfidence,
            dataNote:        liquidityData.dataNote,
          },
        },
        bridgeRisk: {
          score:     bridgeResult.score,
          breakdown: bridgeResult.breakdown,
          bridges:   bridgeResult.bridges,
        },
        strategy: strategyResult,
        overall:  overallScore,
      },

      // Raw chart data (for Recharts volume bar chart)
      chart: {
        volumeHistory: volumeHistory.slice(-30),
      },
    });

  } catch (err) {
    // Specific CoinGecko SDK error types (from contextg.md rules)
    if (err instanceof Coingecko.NotFoundError) {
      return NextResponse.json(
        { error: "Token not found on CoinGecko. Check the contract address and chain." },
        { status: 404 },
      );
    }
    if (err instanceof Coingecko.RateLimitError) {
      return NextResponse.json(
        { error: "CoinGecko rate limit hit. Please wait a moment and retry." },
        { status: 429 },
      );
    }
    if (err instanceof Coingecko.APIError) {
      return NextResponse.json(
        { error: `CoinGecko API error: ${err.name} (${err.status})` },
        { status: err.status ?? 500 },
      );
    }
    console.error("[/api/analyze] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
