/**
 * app/api/liquidity/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/liquidity?token={address}&chain={chain}
 *
 * Standalone endpoint for DeFiLlama pool liquidity data.
 * Returns real TVL, pool count, top pools, and price confidence.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchLiquidityData } from "@/lib/liquidity";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim() ?? "";
  const chain = searchParams.get("chain")?.trim() ?? "ethereum";

  if (!token.startsWith("0x") || token.length !== 42) {
    return NextResponse.json(
      { error: "Invalid token address. Must be 0x… 42 characters." },
      { status: 400 },
    );
  }

  const data = await fetchLiquidityData(token, chain);
  return NextResponse.json(data);
}
