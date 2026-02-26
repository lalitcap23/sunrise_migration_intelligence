/**

 * HOW WE CLASSIFY DEX vs CEX:
 *  - A curated set of well-known DEX identifiers is matched against the
 *    ticker's `market.identifier`.
 *  - Anything not in the DEX list is treated as a CEX.
 *  - We also capture Uniswap v2/v3 style pool addresses in the target field
 *    as a secondary signal.
 *
 * OUTPUT STRUCTURE:
 *  ┌────────────────────┬──────────────────────────────────────────────────────┐
 *  │ dexListings        │ Array of unique DEXes with top pair + volume         │
 *  │ cexListings        │ Array of unique CEXes with top pair + trust score    │
 *  │ totalDexCount      │ Unique DEX count                                     │
 *  │ totalCexCount      │ Unique CEX count                                     │
 *  │ totalVolumeUsd     │ Sum of USD volume across all tickers                 │
 *  │ topVenueName       │ Highest-volume single venue                          │
 *  └────────────────────┴──────────────────────────────────────────────────────┘
 */

const DEX_IDENTIFIERS = new Set([
    // Ethereum / EVM DEXes
    "uniswap",
    "uniswap_v2",
    "uniswap_v3",
    "sushiswap",
    "sushiswap_v2",
    "sushiswap_v3",
    "curve",
    "curve_finance",
    "balancer_v2",
    "balancer",
    "1inch",
    "kyberswap_elastic",
    "kyberswap",
    "pancakeswap_new",
    "pancakeswap_v2",
    "pancakeswap_v3",
    "pancakeswap",
    "quickswap",
    "quickswap_v3",
    "trader_joe",
    "traderjoe_v2",
    "velodrome",
    "aerodrome",
    "camelot",
    "camelot_v3",
    "fraxswap",
    "shibaswap",
    "biswap",
    "apeswap",
    "spookyswap",
    "spiritswap",
    "dystopia",
    "solidly",
    "solidex",
    "thena",
    "wombatexchange",
    "dodo",
    "dodo_bsc",
    "maverick_protocol",
    "ui_v3",
    "clipper",
    "verse_dex",
    "hashflow",
    // Solana DEXes
    "raydium",
    "orca",
    "serum",
    "openbook",
    "jupiter",
    "lifinity",
    "meteora",
    "saros",
    // Other / multi-chain
    "osmosis",
    "terraswap",
    "astroport",
    "dfx_finance",
    "ref_finance",
    "trisolaris",
    "wannaswap",
    "vvs_finance",
    "mm_finance",
    "defi_kingdoms",
    "pangolin",
    "traderjoe",
    "platypusfinance",
    "elk_finance",
    "soulswap",
    "spiritswap",
    "beethoven_x",
    "zipswap",
]);


export type ExchangeListing = {
    name: string;          
    identifier: string;    
    type: "dex" | "cex";
    pair: string;          
    volumeUsd: number;     
    trustScore: string | null;  
    url: string | null;    
};

export type ExchangeListingsResult = {
    dexListings: ExchangeListing[];
    cexListings: ExchangeListing[];
    totalDexCount: number;
    totalCexCount: number;
    totalVolumeUsd: number;
    topVenueName: string | null;
    dataNote: string;
};


type CoinGeckoTicker = {
    base: string;
    target: string;
    market?: {
        name: string;
        identifier: string;
        has_trading_incentive?: boolean;
        logo?: string;
    };
    volume?: number;
    converted_volume?: { usd?: number };
    trust_score?: string;
    trade_url?: string | null;
};


/**
 * Converts a raw CoinGecko `tickers` array into categorised DEX/CEX listings.
 *
 * @param tickers  Raw tickers array from `coinData.tickers`
 * @param symbol   Token symbol (used for pair display filtering)
 */
export function parseExchangeListings(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tickers: any[],
    symbol: string,
): ExchangeListingsResult {
    if (!Array.isArray(tickers) || tickers.length === 0) {
        return {
            dexListings: [],
            cexListings: [],
            totalDexCount: 0,
            totalCexCount: 0,
            totalVolumeUsd: 0,
            topVenueName: null,
            dataNote: "No ticker data available from CoinGecko.",
        };
    }

  // step 1: Group tickers by exchange identifier
    // We want ONE entry per unique exchange (the one with the highest USD volume).

    const bestByExchange = new Map<string, CoinGeckoTicker>();

    for (const ticker of tickers as CoinGeckoTicker[]) {
        const id = ticker.market?.identifier;
        if (!id) continue;

        const volUsd = ticker.converted_volume?.usd ?? 0;
        const existing = bestByExchange.get(id);

        if (!existing || volUsd > (existing.converted_volume?.usd ?? 0)) {
            bestByExchange.set(id, ticker);
        }
    }

    //  Step 2: Classify and build listing objects 

    const dexListings: ExchangeListing[] = [];
    const cexListings: ExchangeListing[] = [];

    for (const [id, ticker] of bestByExchange) {
        if (!ticker.market) continue;

        const isDex = DEX_IDENTIFIERS.has(id.toLowerCase()) ||
            // Heuristic: if the "target" looks like a contract address (0x…), it's a DEX pair
            ticker.target?.startsWith("0x") ||
            // Some DEXes expose their identifier like "uniswap_v3_ethereum" etc.
            id.toLowerCase().includes("swap") ||
            id.toLowerCase().includes("dex") ||
            id.toLowerCase().includes("finance") && !id.toLowerCase().includes("binance");

        const volUsd = ticker.converted_volume?.usd ?? 0;

        // Build a human-readable pair. DEX targets are sometimes contract addresses;
        // replace them with a shorter form.
        const rawTarget = ticker.target ?? "";
        const cleanTarget = rawTarget.startsWith("0x")
            ? rawTarget.slice(0, 6) + "…"
            : rawTarget;
        const pair = `${ticker.base ?? symbol}/${cleanTarget || "?"}`;

        const entry: ExchangeListing = {
            name: ticker.market.name,
            identifier: id,
            type: isDex ? "dex" : "cex",
            pair,
            volumeUsd: Math.round(volUsd),
            trustScore: ticker.trust_score ?? null,
            url: ticker.trade_url ?? null,
        };

        if (isDex) {
            dexListings.push(entry);
        } else {
            cexListings.push(entry);
        }
    }

    //Step 3: Sort by volume desc 

    dexListings.sort((a, b) => b.volumeUsd - a.volumeUsd);
    cexListings.sort((a, b) => b.volumeUsd - a.volumeUsd);

    //  Step 4: Compute summary stats 

    const totalVolumeUsd = [...dexListings, ...cexListings].reduce(
        (sum, e) => sum + e.volumeUsd,
        0,
    );

    const allSorted = [...dexListings, ...cexListings].sort(
        (a, b) => b.volumeUsd - a.volumeUsd,
    );
    const topVenueName = allSorted[0]?.name ?? null;

    const dexCount = dexListings.length;
    const cexCount = cexListings.length;

    const dataNote =
        dexCount + cexCount === 0
            ? "No exchange listings found."
            : `Listed on ${cexCount} CEX${cexCount !== 1 ? "es" : ""} and ${dexCount} DEX${dexCount !== 1 ? "es" : ""}. Volume data from CoinGecko.`;

    return {
        dexListings,
        cexListings,
        totalDexCount: dexCount,
        totalCexCount: cexCount,
        totalVolumeUsd,
        topVenueName,
        dataNote,
    };
}
