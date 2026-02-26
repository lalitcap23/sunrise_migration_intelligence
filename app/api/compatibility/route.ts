import { NextRequest, NextResponse } from "next/server";
import { checkTokenCompatibility } from "@/lib/compatibility";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { token, chain } = body as { token?: string; chain?: string };

        if (!token || !chain) {
            return NextResponse.json(
                { error: "token and chain are required" },
                { status: 400 }
            );
        }

        if (!token.startsWith("0x") || token.length !== 42) {
            return NextResponse.json(
                { error: "Invalid contract address" },
                { status: 400 }
            );
        }

        const result = await checkTokenCompatibility(token, chain);
        return NextResponse.json(result);
    } catch (err) {
        console.error("[compatibility] error:", err);
        return NextResponse.json(
            { error: "Compatibility check failed" },
            { status: 500 }
        );
    }
}
