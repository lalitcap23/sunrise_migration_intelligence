/**
 * BRIDGE DATA MODULE
 *
 * Returns enriched bridge entries for a given source chain, combining:
 *
 *  1. WORMHOLE  — LIVE data from the public Wormhole Scan API
 *     - GET https://api.wormholescan.io/api/v1/governor/notional/available
 *     - GET https://api.wormholescan.io/api/v1/governor/notional/limit
 *     Gives us: availableNotional, notionalLimit, maxTransactionSize (all USD)
 *     which lets us show real capacity %, congestion level, and max single-tx size.

*/
// ─── Wormhole chain IDs ───────────────────────────────────────────────────────
// Source: https://docs.wormhole.com/wormhole/reference/constants


//capacityPct  = availableNotional / notionalLimit × 100
//congestion   = "Low" if <30% used | "Moderate" <70% | "High" ≥70%

const WORMHOLE_CHAIN_ID: Record<string, number> = {
    ethereum: 2,
    bsc: 4,
    polygon: 5,
};


export type BridgeEntryEnriched = {
    name: string;
    supported: boolean;
    estimatedCostUsd: string;
    finalityMin: number;
    // Wormhole-specific live fields 
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
    chain: string
    bridges: BridgeEntryEnriched[];
    supportedBridgeCount: number;
    fastestBridgeName: string | null;
    fastestFinalityMin: number | null;
    dataNote: string;
};


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

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchBridgeData(chain: string): Promise<BridgesResult> {
    const wormholeData = await fetchWormholeChainData(chain);

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
            ? "Live — api.wormholescan.io"
            : "Wormhole API unavailable — static fallback",
    };

    const notionalNote = wormholeData
        ? `Wormhole ${chain}: ${formatUsd(wormholeData.availableNotional)} available of ${formatUsd(wormholeData.dailyLimit)} daily limit · max tx: ${formatUsd(wormholeData.maxTxSize)}.`
        : "Wormhole capacity data unavailable.";

    return {
        chain,
        bridges: [wormholeEntry],
        supportedBridgeCount: 1,
        fastestBridgeName: "Wormhole",
        fastestFinalityMin: WORMHOLE_FIN[chain] ?? 15,
        dataNote: notionalNote,
    };
}
