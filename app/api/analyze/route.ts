/**
 * This route is a THIN ORCHESTRATOR. Its only jobs are:
 *  1. Validate the incoming request
 *  2. Fetch raw data from CoinGecko (via lib/coingecko.ts)
 *  3. Pass raw numbers into the scoring engine (lib/scoring.ts)
 *  4. Return a clean, structured JSON response
 *
 */

import { NextRequest, NextResponse } from "next/server";
import Coingecko from "@coingecko/coingecko-typescript";
import { geckoClient, PLATFORM_MAP } from "@/lib/coingecko";
import { fetchHolderData } from "@/lib/holders";
import { fetchLiquidityData } from "@/lib/liquidity";
import { fetchBridgeData } from "@/lib/bridges";

import {
  calcDemandScore,
  calcMarketPresenceScore,
  calcLiquidityScore,
  calcDumpRiskScore,
  recommendStrategy,
  calcOverallScore,
  clamp,
} from "@/lib/scoring";


function isValidAddress(addr: string): boolean {
  return typeof addr === "string" && addr.startsWith("0x") && addr.length === 42;
}


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
    const [coinData, chartData, holderData, liquidityData, bridgeData] = await Promise.all([
      geckoClient.coins.contract.get(token, { id: platformId }),
      geckoClient.coins.contract.marketChart.get(token, {
        id: platformId,
        vs_currency: "usd",
        days: "30",
      }),
      fetchHolderData(token, chain),
      fetchLiquidityData(token, chain),
      fetchBridgeData(chain),
    ]);

    const md = coinData.market_data ?? {};
    const cd = coinData.community_data ?? {};

    const volume24h = (md.total_volume as Record<string, number>)?.usd ?? 0;
    const marketCap = (md.market_cap as Record<string, number>)?.usd ?? 0;
    const currentPrice = (md.current_price as Record<string, number>)?.usd ?? 0;
    const high24h = (md.high_24h as Record<string, number>)?.usd ?? currentPrice * 1.05;
    const low24h = (md.low_24h as Record<string, number>)?.usd ?? currentPrice * 0.95;

    const marketCapRank = md.market_cap_rank ?? null;
    const priceChange7d = md.price_change_percentage_7d ?? 0;
    const priceChange30d = md.price_change_percentage_30d ?? 0;
    const circulatingSupply = md.circulating_supply ?? 0;
    const totalSupply = md.total_supply ?? circulatingSupply;

    const watchlistUsers = coinData.watchlist_portfolio_users ?? 0;
    const tickerCount = (coinData.tickers ?? []).length;

    // ── Step 4: Run scoring engine

    const demandResult = calcDemandScore({
      volume24h,
      marketCap,
      marketCapRank,
      priceChange7d,
      priceChange30d,
    });

    const marketPresenceResult = calcMarketPresenceScore({
      uniqueRecipients: holderData.uniqueRecipients,
      top10TransferPct: holderData.top10TransferPct,
      holderDataAvailable: holderData.supported && holderData.uniqueRecipients > 0,
      tickerCount,
      watchlistUsers,
    });

    const liquidityResult = calcLiquidityScore({
      totalPoolTvlUsd: liquidityData.totalPoolTvlUsd,
      poolCount: liquidityData.poolCount,
      priceConfidence: liquidityData.priceConfidence,
      volume24h,
      marketCap,
      currentPrice,
      tickerCount,
      high24h,
      low24h,
      chain,
    });

    const bridgeScore = clamp(30 + bridgeData.supportedBridgeCount * 20);
    const bridgeBreakdown: Record<string, string | number> = {
      "Source Chain": chain,
      "Bridges Available": bridgeData.supportedBridgeCount,
      "Fastest Bridge": bridgeData.fastestBridgeName ?? "None",
      "Fastest Finality (min)": bridgeData.fastestFinalityMin ?? 0,
    };
    // Append live Wormhole stats if available
    const wh = bridgeData.bridges.find((b) => b.name === "Wormhole")?.wormhole;
    if (wh && wh.capacityPct !== null) {
      const fmtCap = (n: number) =>
        n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;
      bridgeBreakdown["Wormhole Congestion"] = wh.congestion;
      bridgeBreakdown["Wormhole Capacity Used"] = `${100 - wh.capacityPct}%`;
      bridgeBreakdown["Wormhole Available (24h)"] = fmtCap(wh.availableNotionalUsd ?? 0);
      bridgeBreakdown["Wormhole Max Single Tx"] = fmtCap(wh.maxSingleTxUsd ?? 0);
    }

    const dumpRiskResult = calcDumpRiskScore({
      top10TransferPct: holderData.top10TransferPct,
      holderDataAvailable: holderData.supported && holderData.uniqueRecipients > 0,
      circulatingSupply,
      totalSupply,
      priceChange7d,
      priceChange30d,
      volume24h,
      marketCap,
    });

    const allScores = {
      demand: demandResult.score,
      marketPresence: marketPresenceResult.score,
      liquidity: liquidityResult.score,
      bridgeRisk: bridgeScore,
      dumpRisk: dumpRiskResult.score,
    };

    const strategyResult = recommendStrategy(allScores);
    const overallScore = calcOverallScore(allScores);

    // ── Step 5: Build 30-day volume history for charts ────────────────────────
    const volumeHistory = (chartData.total_volumes ?? []).map((entry: number[]) => ({
      date: new Date(entry[0] ?? 0).toISOString().split("T")[0],
      volumeUsd: Math.round(entry[1] ?? 0),
    }));

    return NextResponse.json({
      // Token identity
      token: {
        address: token,
        chain,
        name: coinData.name ?? "Unknown",
        symbol: coinData.symbol?.toUpperCase() ?? "???",
        image: (coinData.image as Record<string, string>)?.small ?? null,
        currentPrice,
        marketCap,
        circulatingSupply,
        totalSupply,
        // All chains where this token exists — useful for cross-chain context
        platforms: coinData.platforms ?? {},
      },

      // Top-level scores (for the summary card in the UI)
      scores: {
        demand: demandResult.score,
        marketPresence: marketPresenceResult.score,
        liquidity: liquidityResult.score,
        bridgeRisk: bridgeScore,
        dumpRisk: dumpRiskResult.score,
        overall: overallScore,
      },

      // Per-module detail (for the breakdown tables in the UI)
      modules: {
        demand: {
          score: demandResult.score,
          breakdown: demandResult.breakdown,
        },
        marketPresence: {
          score: marketPresenceResult.score,
          breakdown: marketPresenceResult.breakdown,
          // Raw Etherscan data for the UI (top holder list, etc.)
          holderData: {
            uniqueRecipients: holderData.uniqueRecipients,
            top10TransferPct: holderData.top10TransferPct,
            top10Addresses: holderData.top10Addresses,
            totalTransfersAnalyzed: holderData.totalTransfersAnalyzed,
            supported: holderData.supported,
            dataNote: holderData.dataNote,
          },
        },
        liquidity: {
          score: liquidityResult.score,
          breakdown: liquidityResult.breakdown,
          // AMM slippage estimates for 4 reference trade sizes (DeFiLlama TVL-based)
          slippage: liquidityResult.slippage,
          slippageNote: liquidityResult.slippageNote,
          // Solana post-migration CPMM simulation
          sim: liquidityResult.sim,
          // Raw DeFiLlama data for the UI (top pool list, TVL, confidence)
          poolData: {
            totalPoolTvlUsd: liquidityData.totalPoolTvlUsd,
            poolCount: liquidityData.poolCount,
            topPools: liquidityData.topPools,
            priceConfidence: liquidityData.priceConfidence,
            dataNote: liquidityData.dataNote,
          },
        },
        bridgeRisk: {
          score: bridgeScore,
          breakdown: bridgeBreakdown,
          bridges: bridgeData.bridges.map((b) => ({
            name: b.name,
            supported: b.supported,
            estimatedCost: b.estimatedCostUsd,
            finalityMin: b.finalityMin,
            dataSource: b.dataSource,
            wormhole: b.wormhole,
          })),
          dataNote: bridgeData.dataNote,
        },
        dumpRisk: {
          score: dumpRiskResult.score,
          breakdown: dumpRiskResult.breakdown,
        },
        strategy: strategyResult,
        overall: overallScore,
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
