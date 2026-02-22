/**
 * lib/holders.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * HOLDER DATA FETCHER — Etherscan V2 API (free tier)
 *
 * WHY Etherscan V2?
 *  - One API key works for Ethereum (chainid=1) and Polygon (chainid=137).
 *  - BSC (chainid=56) requires a separate BscScan key (free at bscscan.com).
 *  - V1 (api.etherscan.io/api) is deprecated — we use V2.
 *
 * FREE ENDPOINTS USED:
 *  1. stats/tokensupply   → raw total supply of the token
 *  2. account/tokentx     → last N token transfer events (up to 10k per call)
 *
 * WHAT WE COMPUTE FROM FREE DATA:
 *  ┌──────────────────────────┬──────────────────────────────────────────────┐
 *  │ Metric                   │ How                                          │
 *  ├──────────────────────────┼──────────────────────────────────────────────┤
 *  │ uniqueRecipients         │ Count of unique `to` addresses in last 1000  │
 *  │                          │ transfers → lower-bound on recent active      │
 *  │                          │ holders.                                      │
 *  ├──────────────────────────┼──────────────────────────────────────────────┤
 *  │ top10TransferPct         │ % of total transfer VALUE that went to the   │
 *  │                          │ top 10 recipient addresses. High % = few     │
 *  │                          │ wallets accumulating = centralization risk.  │
 *  ├──────────────────────────┼──────────────────────────────────────────────┤
 *  │ top10Addresses           │ The actual top 10 wallet addresses + their   │
 *  │                          │ share of recent transfers.                   │
 *  └──────────────────────────┴──────────────────────────────────────────────┘
 *
 * ⚠️  IMPORTANT LIMITATION:
 *  This is NOT the same as "top 10 holders by total balance".
 *  It measures concentration of RECENT TRANSFER ACTIVITY.
 *  For total balance concentration you need Etherscan Pro or Moralis.
 *  However, high recent-transfer concentration is a valid risk signal —
 *  it shows accumulation behaviour, which is meaningful for migration.
 *
 * CHAIN SUPPORT:
 *  - ethereum → chainid=1  (this key ✅)
 *  - polygon  → chainid=137 (this key ✅)
 *  - bsc      → chainid=56  (needs BscScan key — fallback to null data)
 */

const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api";

// Maps our internal chain IDs to Etherscan V2 chainid values.
// BSC is intentionally absent — needs a separate BscScan key.
const CHAIN_ID_MAP: Record<string, string> = {
  ethereum: "1",
  polygon:  "137",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type TopHolder = {
  address: string;
  receivedPct: number; // % of recent transfer volume received by this wallet
};

export type HolderData = {
  supported: boolean;         // false when chain has no free Etherscan support (BSC)
  uniqueRecipients: number;   // unique wallets that received tokens in last 1000 txs
  top10TransferPct: number;   // % of recent transfer volume going to top 10 wallets
  top10Addresses: TopHolder[];
  totalTransfersAnalyzed: number;
  chain: string;
  dataNote: string;
};

// ─── Internal Etherscan response types ────────────────────────────────────────

type EtherscanResponse<T> = {
  status: "1" | "0";
  message: string;
  result: T;
};

type TokenTx = {
  from: string;
  to: string;
  value: string;       // raw token amount (string, may be huge integer)
  tokenDecimal: string;
  blockNumber: string;
  hash: string;
};

// ─── Helper: build Etherscan V2 URL ──────────────────────────────────────────

function buildUrl(chainId: string, params: Record<string, string>): string {
  const query = new URLSearchParams({
    chainid: chainId,
    apikey: process.env.ETHERSCAN_API_KEY ?? "",
    ...params,
  });
  return `${ETHERSCAN_BASE}?${query.toString()}`;
}

// ─── Main fetch function ──────────────────────────────────────────────────────

/**
 * Fetches holder concentration data for any ERC-20 / ERC-20-compatible token.
 *
 * @param tokenAddress  - 0x contract address
 * @param chain         - "ethereum" | "polygon" | "bsc"
 * @returns HolderData — always returns a valid object, never throws.
 *          If the chain isn't supported or the API fails, returns safe defaults.
 */
export async function fetchHolderData(
  tokenAddress: string,
  chain: string,
): Promise<HolderData> {
  const chainId = CHAIN_ID_MAP[chain];

  // BSC is not supported on this free Etherscan key
  if (!chainId) {
    return {
      supported: false,
      uniqueRecipients: 0,
      top10TransferPct: 0,
      top10Addresses: [],
      totalTransfersAnalyzed: 0,
      chain,
      dataNote: `${chain} holder data requires a BscScan API key (bscscan.com/myapikey). Add BSCSCAN_API_KEY to .env.`,
    };
  }

  try {
    // ── 1. Fetch the last 1000 transfer events ──────────────────────────────
    //   Using page=1, offset=1000 — this is the max per page on free tier.
    //   sort=desc → most recent first (recent activity matters more for migration).
    const txUrl = buildUrl(chainId, {
      module:          "account",
      action:          "tokentx",
      contractaddress: tokenAddress,
      page:            "1",
      offset:          "1000",
      sort:            "desc",
    });

    const txRes = await fetch(txUrl, { next: { revalidate: 300 } }); // cache 5 min
    const txJson: EtherscanResponse<TokenTx[] | string> = await txRes.json();

    // API returned an error (token not found, rate limited, etc.)
    if (txJson.status !== "1" || !Array.isArray(txJson.result)) {
      return {
        supported: true,
        uniqueRecipients: 0,
        top10TransferPct: 0,
        top10Addresses: [],
        totalTransfersAnalyzed: 0,
        chain,
        dataNote: `Etherscan returned: ${typeof txJson.result === "string" ? txJson.result : "no data"}`,
      };
    }

    const transfers: TokenTx[] = txJson.result;
    const decimals = parseInt(transfers[0]?.tokenDecimal ?? "18", 10);

    // ── 2. Aggregate received volume per wallet ─────────────────────────────
    //   We parse `value` as a BigInt-safe float by dividing by 10^decimals.
    //   Using a Map for O(1) lookup per transfer.
    const receivedByAddress = new Map<string, number>();
    let totalVolume = 0;

    for (const tx of transfers) {
      if (!tx.to || tx.to === "0x0000000000000000000000000000000000000000") continue;

      // Divide by decimals — value is a raw integer string (can be very large)
      const amount = Number(BigInt(tx.value)) / Math.pow(10, decimals);
      const addr = tx.to.toLowerCase();

      receivedByAddress.set(addr, (receivedByAddress.get(addr) ?? 0) + amount);
      totalVolume += amount;
    }

    // ── 3. Sort by received volume and pick top 10 ─────────────────────────
    const sorted = Array.from(receivedByAddress.entries())
      .sort((a, b) => b[1] - a[1]);

    const top10 = sorted.slice(0, 10);
    const top10Volume = top10.reduce((sum, [, v]) => sum + v, 0);
    const top10TransferPct =
      totalVolume > 0 ? (top10Volume / totalVolume) * 100 : 0;

    const top10Addresses: TopHolder[] = top10.map(([address, vol]) => ({
      address,
      receivedPct: totalVolume > 0 ? parseFloat(((vol / totalVolume) * 100).toFixed(2)) : 0,
    }));

    return {
      supported: true,
      uniqueRecipients: receivedByAddress.size,
      top10TransferPct: parseFloat(top10TransferPct.toFixed(2)),
      top10Addresses,
      totalTransfersAnalyzed: transfers.length,
      chain,
      dataNote: `Based on last ${transfers.length} transfers. Concentration = % of transfer volume going to top 10 wallets.`,
    };

  } catch (err) {
    // Never crash the parent analyze route — return safe defaults
    console.error(`[holders] fetch failed for ${chain}:`, err);
    return {
      supported: true,
      uniqueRecipients: 0,
      top10TransferPct: 0,
      top10Addresses: [],
      totalTransfersAnalyzed: 0,
      chain,
      dataNote: "Holder data fetch failed — using neutral defaults.",
    };
  }
}
