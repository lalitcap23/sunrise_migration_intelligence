import { NextRequest, NextResponse } from "next/server";

const PINATA_JWT = process.env.PINATA_JWT ?? "";

export async function POST(req: NextRequest) {
    if (!PINATA_JWT) {
        return NextResponse.json(
            { error: "PINATA_JWT not set in environment. Add it to .env to enable IPFS storage." },
            { status: 503 },
        );
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const {
        tokenName,
        tokenSymbol,
        contractAddress,
        chain,
        analyzedAt,
        scores,
        modules,
        exchanges,
        chart,
    } = body as {
        tokenName: string;
        tokenSymbol: string;
        contractAddress: string;
        chain: string;
        analyzedAt: string;
        scores: Record<string, number>;
        modules: Record<string, unknown>;
        exchanges: Record<string, unknown>;
        chart: Record<string, unknown>;
    };

    if (!contractAddress || !tokenName) {
        return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const pinataBody = {
        pinataContent: {
            meta: {
                source: "Sunrise Migration Intelligence",
                version: "1.0",
                tokenName,
                tokenSymbol,
                contractAddress,
                chain,
                analyzedAt,
            },

            scores,

            modules: {
                demand: {
                    score: (modules?.demand as Record<string, unknown>)?.score,
                    breakdown: (modules?.demand as Record<string, unknown>)?.breakdown,
                },
                marketPresence: {
                    score: (modules?.marketPresence as Record<string, unknown>)?.score,
                    breakdown: (modules?.marketPresence as Record<string, unknown>)?.breakdown,
                    holderData: (modules?.marketPresence as Record<string, unknown>)?.holderData,
                },
                liquidity: {
                    score: (modules?.liquidity as Record<string, unknown>)?.score,
                    breakdown: (modules?.liquidity as Record<string, unknown>)?.breakdown,
                    slippage: (modules?.liquidity as Record<string, unknown>)?.slippage,
                    slippageNote: (modules?.liquidity as Record<string, unknown>)?.slippageNote,
                    sim: (modules?.liquidity as Record<string, unknown>)?.sim,
                    poolData: (modules?.liquidity as Record<string, unknown>)?.poolData,
                },
                bridgeRisk: {
                    score: (modules?.bridgeRisk as Record<string, unknown>)?.score,
                    breakdown: (modules?.bridgeRisk as Record<string, unknown>)?.breakdown,
                    bridges: (modules?.bridgeRisk as Record<string, unknown>)?.bridges,
                    dataNote: (modules?.bridgeRisk as Record<string, unknown>)?.dataNote,
                },
                dumpRisk: {
                    score: (modules?.dumpRisk as Record<string, unknown>)?.score,
                    breakdown: (modules?.dumpRisk as Record<string, unknown>)?.breakdown,
                },
                strategy: modules?.strategy,
                overall: modules?.overall,
            },

            exchanges: {
                dexListings: (exchanges as Record<string, unknown>)?.dexListings,
                cexListings: (exchanges as Record<string, unknown>)?.cexListings,
                totalDexCount: (exchanges as Record<string, unknown>)?.totalDexCount,
                totalCexCount: (exchanges as Record<string, unknown>)?.totalCexCount,
                totalVolumeUsd: (exchanges as Record<string, unknown>)?.totalVolumeUsd,
                topVenueName: (exchanges as Record<string, unknown>)?.topVenueName,
                dataNote: (exchanges as Record<string, unknown>)?.dataNote,
            },

            chart,
        },
        pinataMetadata: {
            name: `${tokenSymbol}-${chain}-${new Date(analyzedAt).toISOString().split("T")[0]}`,
            keyvalues: {
                token: contractAddress,
                chain,
                symbol: tokenSymbol,
                overall: String(scores?.overall ?? 0),
            },
        },
        pinataOptions: {
            cidVersion: 1,
        },
    };

    try {
        const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${PINATA_JWT}`,
            },
            body: JSON.stringify(pinataBody),
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(
                { error: data.error?.details ?? data.error ?? "Pinata error" },
                { status: res.status },
            );
        }

        return NextResponse.json({
            cid: data.IpfsHash,
            size: data.PinSize,
            gateway: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
        });
    } catch (err) {
        console.error("[/api/ipfs] pinata error:", err);
        return NextResponse.json({ error: "Failed to pin to IPFS." }, { status: 500 });
    }
}
