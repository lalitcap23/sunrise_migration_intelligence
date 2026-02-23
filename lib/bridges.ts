/**
 * lib/bridges.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * BRIDGE DATA MODULE
 *
 * Returns enriched bridge entries for a given source chain, combining:
 *
 *  1. WORMHOLE  — LIVE data from the public Wormhole Scan API
 *     - GET https://api.wormholescan.io/api/v1/governor/notional/available
 *     - GET https://api.wormholescan.io/api/v1/governor/notional/limit
 *     Gives us: availableNotional, notionalLimit, maxTransactionSize (all USD)
 *     which lets us show real capacity %, congestion level, and max single-tx size.
 *
 *  2. CCIP (Chainlink)  — Static (no free public API for real-time quotes)
 *     CCIP does NOT support BSC→Solana natively. ETH and Polygon are supported.
 *     Source: https://docs.chain.link/ccip/supported-networks
 *
 *  3. LayerZero         — Static (LayerZero Scan API requires project registration)
 *     All three chains (ETH, BSC, Polygon) can route to Solana via LayerZero OFT.
 *     Source: https://layerzeroscan.com
 *
 * WHY STATIC FOR CCIP/LZ?
 *  Their live APIs require project API keys or are not publicly accessible.
 *  Static cost/finality estimates are sourced from each protocol's public docs
 *  and are clearly labelled so users know they're estimates.
 *
 * NEVER THROWS:
 *  If the Wormhole API is unreachable, Wormhole falls back to "Unknown" capacity
 *  so the route always returns a complete response.
 */

// ─── Wormhole chain IDs ───────────────────────────────────────────────────────
// Source: https://docs.wormhole.com/wormhole/reference/constants
const WORMHOLE_CHAIN_ID: Record<string, number> = {
    ethereum: 2,
    bsc: 4,
    polygon: 5,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type BridgeEntryEnriched = {
    name: string;
    supported: boolean;
    // Cost estimate (static for CCIP/LZ, labelled "live" for Wormhole context)
    estimatedCostUsd: string;
    finalityMin: number;
    // Wormhole-specific live fields (null for CCIP/LZ)
    wormhole: {
        availableNotionalUsd: number | null; // current 24h remaining capacity (USD)
        dailyLimitUsd: number | null;         // total 24h governor limit (USD)
        maxSingleTxUsd: number | null;        // maximum single transaction size (USD)
        capacityPct: number | null;           // availableNotional / limit  * 100
        congestion: "Low" | "Moderate" | "High" | "Unknown";
    } | null;
    dataSource: string;
};

export type BridgesResult = {
    chain: string;
    bridges: BridgeEntryEnriched[];
    supportedBridgeCount: number;
    fastestBridgeName: string | null;
    fastestFinalityMin: number | null;
    dataNote: string;
};

// ─── Wormhole API types ───────────────────────────────────────────────────────

type WormholeNotionalAvailable = {
    data: Array<{ chainId: number; availableNotional: number }>;
};

type WormholeNotionalLimit = {
    data: Array<{
        chainId: number;
        notionalLimit: number;
        maxTransactionSize: number;
    }>;
};

// ─── Wormhole live data fetcher ───────────────────────────────────────────────

const WORMHOLE_BASE = "https://api.wormholescan.io/api/v1";

type WormholeChainData = {
    availableNotional: number;
    dailyLimit: number;
    maxTxSize: number;
    capacityPct: number;
    congestion: "Low" | "Moderate" | "High" | "Unknown";
} | null;

async function fetchWormholeChainData(chain: string): Promise<WormholeChainData> {
    const chainId = WORMHOLE_CHAIN_ID[chain];
    if (!chainId) return null;

    try {
        // Fire both API calls in parallel — free, no auth required
        const [availRes, limitRes] = await Promise.all([
            fetch(`${WORMHOLE_BASE}/governor/notional/available`, { next: { revalidate: 60 } }),
            fetch(`${WORMHOLE_BASE}/governor/notional/limit`, { next: { revalidate: 300 } }),
        ]);

        if (!availRes.ok || !limitRes.ok) return null;

        const [availData, limitData] = await Promise.all([
            availRes.json() as Promise<WormholeNotionalAvailable>,
            limitRes.json() as Promise<WormholeNotionalLimit>,
        ]);

        const avail = availData.data.find((d) => d.chainId === chainId);
        const limit = limitData.data.find((d) => d.chainId === chainId);

        if (!avail || !limit || limit.notionalLimit === 0) return null;

        const capacityPct = Math.round((avail.availableNotional / limit.notionalLimit) * 100);

        // Congestion = inverse of capacity used
        const usedPct = 100 - capacityPct;
        const congestion: "Low" | "Moderate" | "High" =
            usedPct < 30 ? "Low" : usedPct < 70 ? "Moderate" : "High";

        return {
            availableNotional: avail.availableNotional,
            dailyLimit: limit.notionalLimit,
            maxTxSize: limit.maxTransactionSize,
            capacityPct,
            congestion,
        };
    } catch {
        return null; // API unreachable — graceful fallback
    }
}

// ─── Static bridge definitions ────────────────────────────────────────────────
//
// Cost ranges sourced from each protocol's public documentation:
//  - Wormhole:   https://docs.wormhole.com
//  - CCIP:       https://docs.chain.link/ccip/billing
//  - LayerZero:  https://docs.layerzero.network
//
// CCIP does NOT support BSC→Solana. ETH and Polygon are supported.
//

type StaticBridge = {
    name: string;
    isCcip: boolean;
    isLayerZero: boolean;
    estimatedCostByChain: Record<string, string>;
    finalityByChain: Record<string, number>;
    supportedChains: string[];
    dataSource: string;
};

const STATIC_BRIDGES: StaticBridge[] = [
    {
        name: "CCIP (Chainlink)",
        isCcip: true,
        isLayerZero: false,
        estimatedCostByChain: {
            ethereum: "$5–15",
            bsc: "Not supported",
            polygon: "$2–8",
        },
        finalityByChain: {
            ethereum: 20,
            bsc: 0,
            polygon: 15,
        },
        supportedChains: ["ethereum", "polygon"], // BSC not supported for Solana route
        dataSource: "Static — docs.chain.link/ccip",
    },
    {
        name: "LayerZero",
        isCcip: false,
        isLayerZero: true,
        estimatedCostByChain: {
            ethereum: "$2–6",
            bsc: "$1–3",
            polygon: "$0.5–2",
        },
        finalityByChain: {
            ethereum: 10,
            bsc: 5,
            polygon: 5,
        },
        supportedChains: ["ethereum", "bsc", "polygon"],
        dataSource: "Static — docs.layerzero.network",
    },
];

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchBridgeData(chain: string): Promise<BridgesResult> {
    // Fetch live Wormhole data and static bridges in parallel  
    const [wormholeData] = await Promise.all([fetchWormholeChainData(chain)]);

    // ── 1. Wormhole entry (live data) ──────────────────────────────────────────
    const formatUsd = (n: number) =>
        n >= 1_000_000
            ? `$${(n / 1_000_000).toFixed(1)}M`
            : `$${(n / 1_000).toFixed(0)}K`;

    const WORMHOLE_COST: Record<string, string> = { ethereum: "$3–8", bsc: "$1–4", polygon: "$0.5–2" };
    const WORMHOLE_FIN: Record<string, number> = { ethereum: 15, bsc: 5, polygon: 5 };

    const wormholeEntry: BridgeEntryEnriched = {
        name: "Wormhole",
        supported: true,
        estimatedCostUsd: WORMHOLE_COST[chain] ?? "$3–8",
        finalityMin: WORMHOLE_FIN[chain] ?? 15,
        wormhole: wormholeData
            ? {
                availableNotionalUsd: wormholeData.availableNotional,
                dailyLimitUsd: wormholeData.dailyLimit,
                maxSingleTxUsd: wormholeData.maxTxSize,
                capacityPct: wormholeData.capacityPct,
                congestion: wormholeData.congestion,
            }
            : {
                availableNotionalUsd: null,
                dailyLimitUsd: null,
                maxSingleTxUsd: null,
                capacityPct: null,
                congestion: "Unknown",
            },
        dataSource: wormholeData
            ? "Live — api.wormholescan.io (governor notional)"
            : "Wormhole API unavailable — static fallback",
    };

    // ── 2. Static bridges (CCIP + LayerZero) ───────────────────────────────────
    const staticEntries: BridgeEntryEnriched[] = STATIC_BRIDGES.map((b) => {
        const supported = b.supportedChains.includes(chain);
        return {
            name: b.name,
            supported,
            estimatedCostUsd: supported
                ? b.estimatedCostByChain[chain] ?? "N/A"
                : "Not supported",
            finalityMin: supported ? b.finalityByChain[chain] ?? 0 : 0,
            wormhole: null,
            dataSource: b.dataSource,
        };
    });

    const bridges: BridgeEntryEnriched[] = [wormholeEntry, ...staticEntries];
    const supported = bridges.filter((b) => b.supported);

    // Fastest by finality
    const fastest = supported.reduce<BridgeEntryEnriched | null>(
        (acc, b) =>
            acc === null || b.finalityMin < (acc?.finalityMin ?? Infinity) ? b : acc,
        null,
    );

    // Wormhole notional display for the data note
    const notionalNote = wormholeData
        ? `Wormhole ${chain} governor: ${formatUsd(wormholeData.availableNotional)} available of ${formatUsd(wormholeData.dailyLimit)} daily limit (max tx: ${formatUsd(wormholeData.maxTxSize)}).`
        : "Wormhole capacity data unavailable.";

    return {
        chain,
        bridges,
        supportedBridgeCount: supported.length,
        fastestBridgeName: fastest?.name ?? null,
        fastestFinalityMin: fastest?.finalityMin ?? null,
        dataNote: `${notionalNote} CCIP and LayerZero costs are static estimates from protocol docs.`,
    };
}
