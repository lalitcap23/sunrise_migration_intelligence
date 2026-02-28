/**
 * app/api/bridges/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/bridges?chain={chain}
 *
 * Standalone bridge data endpoint.
 * Returns enriched bridge entries for the given source chain:
 *
 *  - Wormhole  → LIVE governor notional data (capacity, daily limit, max tx)
 *                from api.wormholescan.io 
 *
 * The /api/analyze route uses the static calcBridgeScore() from lib/scoring.ts
 * for scoring purposes. This endpoint goes deeper — it returns the full live
 * Wormhole notional data for display in the UI bridge table.
 *
 * Supported chains: ethereum | polygon
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchBridgeData } from "@/lib/bridges";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const chain = searchParams.get("chain")?.trim().toLowerCase() ?? "ethereum";

    const SUPPORTED_CHAINS = ["ethereum", "bsc", "polygon"];
    if (!SUPPORTED_CHAINS.includes(chain)) {
        return NextResponse.json(
            {
                error: `Unsupported chain "${chain}". Supported: ${SUPPORTED_CHAINS.join(", ")}.`,
            },
            { status: 400 },
        );
    }

    // fetchBridgeData never throws — Wormhole failures degrade gracefully
    const data = await fetchBridgeData(chain);
    return NextResponse.json(data);
}
