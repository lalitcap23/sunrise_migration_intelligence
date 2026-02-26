/**
* LIQUIDITY DATA FETCHER — DeFiLlama API 
 *
 * ENDPOINTS USED:
 * ┌──────────────────────────────────────────────┬──────────────┬────────────┐
 * │ URL                                          │ Speed        │ Cached     │
 * ├──────────────────────────────────────────────┼──────────────┼────────────┤
 * │ coins.llama.fi/prices/current/{chain}:{addr} │ ~200ms       │ 5 min      │
 * │   → price + confidence score (0–1)           │              │            │
 * ├──────────────────────────────────────────────┼──────────────┼────────────┤
 * │ yields.llama.fi/pools                        │ ~3s first    │ 1 hr       │
 * │   → ALL 18k yield pools with TVL             │ ~instant     │ (shared)   │
 * │   → we filter by token address               │ after cache  │            │
 * └──────────────────────────────────────────────┴──────────────┴────────────┘
 *

 *
 * WHAT WE COMPUTE:
 *  ┌──────────────────────┬──────────────────────────────────────────────────┐
 *  │ totalPoolTvlUsd      │ Sum of TVL across ALL DEX pools holding this     │
 *  │                      │ token. This directly answers contexts.md:         │
 *  │                      │ "Total liquidity on all major venues"             │
 *  ├──────────────────────┼──────────────────────────────────────────────────┤
 *  │ poolCount            │ How many distinct DEX pools hold this token.      │
 *  │                      │ More pools = more accessible = better migration   │
 *  ├──────────────────────┼──────────────────────────────────────────────────┤
 *  │ topPools             │ Top 5 pools by TVL (project name, symbol, TVL)   │
 *  ├──────────────────────┼──────────────────────────────────────────────────┤
 *  │ priceConfidence      │ DeFiLlama confidence score 0–1. Measures how     │
 *  │                      │ consistently the price is quoted across sources.  │
 *  │                      │ Low confidence = thin/unreliable liquidity.       │
 *  └──────────────────────┴──────────────────────────────────────────────────┘
 *
 * CHAIN MAPPING (DeFiLlama naming vs our internal IDs):
 *  Our ID   │ coins.llama.fi prefix │ yields chain filter
 *  ethereum │ "ethereum"            │ "Ethereum"
 *  bsc      │ "bsc"                 │ "BSC"
 *  polygon  │ "polygon"             │ "Polygon"
 */

// DeFiLlama chain name maps 

// Used in `coins.llama.fi/prices/current/{prefix}:{address}`
const COINS_CHAIN_PREFIX: Record<string, string> = {
  ethereum: "ethereum",
  bsc:      "bsc",
  polygon:  "polygon",
};

// Used to filter pools from `yields.llama.fi/pools` (these are title-cased)
const YIELDS_CHAIN_NAME: Record<string, string> = {
  ethereum: "Ethereum",
  bsc:      "BSC",
  polygon:  "Polygon",
};

// Types 

export type PoolEntry = {
  project: string;   // e.g. "aave-v3", "uniswap-v3"
  symbol: string;    
  tvlUsd: number;
  apy: number | null;
  poolId: string;
};

export type LiquidityData = {
  totalPoolTvlUsd: number;   // sum of TVL across all matching pools
  poolCount: number;         // how many pools hold this token
  topPools: PoolEntry[];     // top 5 by TVL
  priceConfidence: number;   // 0–1 from DeFiLlama coins API
  priceUsd: number;          // price from DeFiLlama (cross-check with CoinGecko)
  chain: string;
  dataNote: string;
};

// Internal DeFiLlama types
type DefiLlamaPool = {
  pool: string;
  project: string;
  symbol: string;
  chain: string;
  tvlUsd: number;
  apy: number | null;
  underlyingTokens: string[] | null;
};

type DefiLlamaPriceResponse = {
  coins: Record<string, {
    price: number;
    confidence: number;
    decimals: number;
    symbol: string;
    timestamp: number;
  }>;
};

type DefiLlamaPoolsResponse = {
  data: DefiLlamaPool[];
};

// Main fetch function

/**
 * Fetches real pool TVL and price confidence for a token from DeFiLlama.
 * Never throws — returns safe defaults on any API failure.
 *
 * @param tokenAddress  ERC-20 contract address (0x…)
 * @param chain         "ethereum" | "bsc" | "polygon"
 */
export async function fetchLiquidityData(
  tokenAddress: string,
  chain: string,
): Promise<LiquidityData> {
  const coinsPrefix   = COINS_CHAIN_PREFIX[chain] ?? "ethereum";
  const yieldsChain   = YIELDS_CHAIN_NAME[chain] ?? "Ethereum";
  const addressLower  = tokenAddress.toLowerCase();
  const coinsKey      = `${coinsPrefix}:${tokenAddress}`;

  try {
    // ── Run both DeFiLlama calls in parallel 
    const [priceRes, poolsRes] = await Promise.all([

      // 1. Price + confidence — fast, targeted, cached 5 min
      fetch(
        `https://coins.llama.fi/prices/current/${coinsKey}`,
        { next: { revalidate: 300 } },
      ),

      // 2. All yield pools — large (~4MB), but cached 1hr across ALL tokens.
      //    Every token analysis on this server shares this single cached response.
      fetch(
        "https://yields.llama.fi/pools",
        { next: { revalidate: 3600 } },
      ),
    ]);

    //  Parse price / confidence 
    let priceConfidence = 0;
    let priceUsd = 0;

    if (priceRes.ok) {
      const priceJson: DefiLlamaPriceResponse = await priceRes.json();
      const coinData = priceJson.coins[coinsKey];
      if (coinData) {
        priceConfidence = coinData.confidence ?? 0;
        priceUsd = coinData.price ?? 0;
      }
    }

    // Parse and filter pools by token address
    let totalPoolTvlUsd = 0;
    let poolCount = 0;
    const topPools: PoolEntry[] = [];

    if (poolsRes.ok) {
      const poolsJson: DefiLlamaPoolsResponse = await poolsRes.json();

      // Filter: must be on the right chain and contain our token address
      const matchingPools = poolsJson.data
        .filter((p) =>
          p.chain === yieldsChain &&
          Array.isArray(p.underlyingTokens) &&
          p.underlyingTokens.some(
            (t) => t && t.toLowerCase() === addressLower,
          ) &&
          typeof p.tvlUsd === "number" &&
          p.tvlUsd > 0,
        )
        // Sort by TVL descending so top pools appear first
        .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));

      poolCount = matchingPools.length;
      totalPoolTvlUsd = matchingPools.reduce((sum, p) => sum + (p.tvlUsd ?? 0), 0);

      // Keep top 5 for the UI
      for (const p of matchingPools.slice(0, 5)) {
        topPools.push({
          project: p.project,
          symbol:  p.symbol,
          tvlUsd:  Math.round(p.tvlUsd),
          apy:     p.apy != null ? parseFloat(p.apy.toFixed(2)) : null,
          poolId:  p.pool,
        });
      }
    }

    return {
      totalPoolTvlUsd: Math.round(totalPoolTvlUsd),
      poolCount,
      topPools,
      priceConfidence,
      priceUsd,
      chain,
      dataNote: poolCount > 0
        ? `${poolCount} pools found on DeFiLlama. TVL = sum across all matching pools.`
        : "No yield pools found for this token on DeFiLlama. Token may not be indexed yet.",
    };

  } catch (err) {
    // Never crash the parent  return safe defaults
    console.error(`[liquidity] DeFiLlama fetch failed for ${chain}:`, err);
    return {
      totalPoolTvlUsd: 0,
      poolCount: 0,
      topPools: [],
      priceConfidence: 0,
      priceUsd: 0,
      chain,
      dataNote: "DeFiLlama fetch failed — using CoinGecko volume proxy for liquidity score.",
    };
  }
}
