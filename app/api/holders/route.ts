/**
 * app/api/holders/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/holders?token={address}&chain={chain}
 *
 * Standalone endpoint for holder concentration data.
 * The main /api/analyze route also calls this internally via lib/holders.ts,
 * but having it as a separate endpoint lets you:
 *  - Query holder data independently (useful for the Sunrise team)
 *  - Test it in isolation during development
 *  - Cache it separately from the full analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchHolderData } from "@/lib/holders";

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

  const data = await fetchHolderData(token, chain);
  return NextResponse.json(data);
}
