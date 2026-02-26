import { NextRequest, NextResponse } from "next/server";

const CATEGORY_MAP: Record<string, string> = {
    ethereum: "ethereum-ecosystem",
    bsc: "bnb-chain-ecosystem",
    polygon: "polygon-ecosystem",
};

const PLATFORM_MAP: Record<string, string> = {
    ethereum: "ethereum",
    bsc: "binance-smart-chain",
    polygon: "polygon-pos",
};

export type TopToken = {
    id: string;
    symbol: string;
    name: string;
    image: string;
    currentPrice: number;
    marketCap: number;
    volume24h: number;
    priceChange24h: number;
    address: string | null;
    rank: number;
};

export async function GET(req: NextRequest) {
    const chain = req.nextUrl.searchParams.get("chain") ?? "ethereum";
    const category = CATEGORY_MAP[chain] ?? "ethereum-ecosystem";
    const platformId = PLATFORM_MAP[chain] ?? "ethereum";

    try {
        const apiKey = process.env.COINGECKO_DEMO_API_KEY;
        const headers: HeadersInit = apiKey
            ? { "x-cg-demo-api-key": apiKey }
            : {};

        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${category}&order=market_cap_desc&per_page=12&page=1&sparkline=false&price_change_percentage=24h`;

        const res = await fetch(url, {
            headers,
            next: { revalidate: 300 },
        });

        if (!res.ok) {
            return NextResponse.json(
                { error: `CoinGecko returned ${res.status}` },
                { status: res.status },
            );
        }

        const raw: Record<string, unknown>[] = await res.json();

        const tokens: TopToken[] = raw
            .filter((t) => typeof t === "object" && t !== null)
            .map((t, i) => {
                const platforms = (t.platforms ?? {}) as Record<string, string>;
                const address = platforms[platformId] ?? null;

                return {
                    id: String(t.id ?? ""),
                    symbol: String(t.symbol ?? "").toUpperCase(),
                    name: String(t.name ?? ""),
                    image: String(t.image ?? ""),
                    currentPrice: Number(t.current_price ?? 0),
                    marketCap: Number(t.market_cap ?? 0),
                    volume24h: Number(t.total_volume ?? 0),
                    priceChange24h: Number(t.price_change_percentage_24h ?? 0),
                    address,
                    rank: i + 1,
                };
            });

        return NextResponse.json({ chain, tokens });
    } catch (err) {
        console.error("[/api/top-tokens] error:", err);
        return NextResponse.json({ error: "Failed to fetch top tokens." }, { status: 500 });
    }
}
