/**
 *
 * Scans ERC-20 contracts for bridge incompatibilities BEFORE migration.
 * Uses:
 *  - Free Etherscan / BscScan / Polygonscan sourcecode API 
 *  - Public JSON-RPC `eth_getStorageAt` for EIP-1967 proxy slot detection
 *
 *  1. Fee-on-transfer  — tax tokens (common on BSC), bridges receive less than sent
 *  2. Rebase supply    — elastic tokens (AMPL-style), breaks bridge 1:1 accounting
 *  3. Pausable         — owner can halt all transfers, locking bridged assets
 *  4. Blacklist        — bridge addresses can be blocked
 *  5. Upgradeable      — logic can change after migration
 *  6. Mintable         — unlimited supply inflation post-migration
 *  7. Active owner     — centralised control not yet renounced
 */


const EXPLORER_API: Record<string, string> = {
    ethereum: "https://api.etherscan.io/api",
    bsc: "https://api.bscscan.com/api",
    polygon: "https://api.polygonscan.com/api",
};

const RPC_URL: Record<string, string> = {
    ethereum: "https://eth.llamarpc.com",
    bsc: "https://bsc-dataseed.binance.org",
    polygon: "https://polygon-rpc.com",
};

/** EIP-1967 implementation storage slot */
const EIP1967_IMPL_SLOT =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ZERO_SLOT =
    "0x0000000000000000000000000000000000000000000000000000000000000000";


export type FlagSeverity = "critical" | "warning" | "info";

export interface CompatibilityFlag {
    id: string;
    label: string;
    severity: FlagSeverity;
    detected: boolean;
    description: string;
    bridgeImpact: string;
}

export interface CompatibilityResult {
    address: string;
    chain: string;
    contractName: string;
    isVerified: boolean;
    isProxy: boolean;
    implementationAddress: string | null;
    flags: CompatibilityFlag[];
    overallCompatibility: "compatible" | "caution" | "incompatible";
    compatibilityScore: number;   
    summary: string;
    bridgeRecommendation: string;
}


/** True if the JSON ABI string contains a function whose name includes any of `names`. */
function abiHasFunction(abi: string, ...names: string[]): boolean {
    if (!abi || abi.length < 5) return false;
    try {
        const parsed = JSON.parse(abi) as { type: string; name?: string }[];
        return parsed.some(
            (entry) =>
                entry.type === "function" &&
                entry.name !== undefined &&
                names.some((n) => entry.name!.toLowerCase().includes(n.toLowerCase()))
        );
    } catch {
        return false;
    }
}

function srcHas(source: string, ...patterns: string[]): boolean {
    const lower = source.toLowerCase();
    return patterns.some((p) => lower.includes(p.toLowerCase()));
}

/** Check EIP-1967 transparent/UUPS proxy via eth_getStorageAt. */
async function detectEip1967Proxy(
    address: string,
    chain: string
): Promise<{ isProxy: boolean; impl: string | null }> {
    const rpc = RPC_URL[chain];
    if (!rpc) return { isProxy: false, impl: null };

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getStorageAt",
                params: [address, EIP1967_IMPL_SLOT, "latest"],
                id: 1,
            }),
            signal: controller.signal,
        });
        clearTimeout(timer);

        const data = await res.json();
        const slot: string = (data.result as string) ?? ZERO_SLOT;
        if (slot === ZERO_SLOT) return { isProxy: false, impl: null };

        const impl = "0x" + slot.slice(-40);
        return { isProxy: true, impl };
    } catch {
        return { isProxy: false, impl: null };
    }
}


export async function checkTokenCompatibility(
    address: string,
    chain: string
): Promise<CompatibilityResult> {
    const apiBase = EXPLORER_API[chain];
    const apiKey = process.env.ETHERSCAN_API_KEY ?? "";

    let abi = "";
    let source = "";
    let contractName = "Unknown";
    let isVerified = false;
    let isProxyApi = false;
    let implApi: string | null = null;

    try {
        const params = apiKey ? `&apikey=${apiKey}` : "";
        const url = `${apiBase}?module=contract&action=getsourcecode&address=${address}${params}`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        const json = await res.json();

        if (json.status === "1" && Array.isArray(json.result) && json.result.length > 0) {
            const r = json.result[0];
            abi = r.ABI !== "Contract source code not verified" ? (r.ABI ?? "") : "";
            source = typeof r.SourceCode === "string" ? r.SourceCode : "";
            contractName = r.ContractName || "Unknown";
            isVerified = abi.length > 10;
            isProxyApi = r.Proxy === "1";
            implApi =
                r.Implementation &&
                    r.Implementation !== "0x0000000000000000000000000000000000000000"
                    ? r.Implementation
                    : null;
        }
    } catch {
    }

    const { isProxy: isProxy1967, impl: impl1967 } = await detectEip1967Proxy(address, chain);

    const isProxy = isProxyApi || isProxy1967;
    const implementationAddress = implApi ?? impl1967;


    const hasFeeTransfer =
        srcHas(source,
            "_taxFee", "_liquidityFee", "_burnFee", "takeFee",
            "_feeAmount", "transferFee", "_reflectionFee", "_devFee"
        ) ||
        abiHasFunction(abi,
            "setFee", "setTaxFee", "setLiquidityFee",
            "setTransferFee", "setReflectionFee"
        );

    const hasPause =
        abiHasFunction(abi, "pause", "unpause", "paused") ||
        srcHas(source, "whenNotPaused", "_pause()", "Pausable");

    const hasBlacklist =
        abiHasFunction(abi,
            "blacklist", "addToBlacklist", "isBlacklisted",
            "banAddress", "blocklist", "addBlacklist", "setBlacklist"
        ) ||
        srcHas(source,
            "blacklisted[", "isBlacklisted[", "blocked[",
            "_isBlacklisted", "blackList["
        );

    const hasRebase =
        abiHasFunction(abi, "rebase", "syncRewards", "changeSupply", "scaledBalanceOf") ||
        srcHas(source, "gonsPerFragment", "_rebase", "scaledBalance", "elastic supply");

    const hasUpgrade =
        isProxy ||
        abiHasFunction(abi, "upgradeTo", "upgradeToAndCall") ||
        srcHas(source, "UUPSUpgradeable", "TransparentUpgradeableProxy", "Initializable");

    const hasMint =
        abiHasFunction(abi, "mint", "issueTokens") ||
        srcHas(source, "function mint(", "function _mint(");

    const hasActiveOwner =
        (abiHasFunction(abi, "transferOwnership") || srcHas(source, "Ownable")) &&
        !srcHas(source, "renounceOwnership()", "_owner = address(0)");


    const flags: CompatibilityFlag[] = [
        {
            id: "fee_on_transfer",
            label: "Fee-on-Transfer",
            severity: "critical",
            detected: hasFeeTransfer,
            description:
                "Token charges a % fee on every transfer (tax/reflection token). Extremely common in BSC meme tokens.",
            bridgeImpact:
                "Bridges receive fewer tokens than sent, causing accounting errors and permanent fund loss. Standard bridges will fail.",
        },
        {
            id: "rebase",
            label: "Rebase / Elastic Supply",
            severity: "critical",
            detected: hasRebase,
            description:
                "Token supply adjusts automatically (AMPL-style elastic supply). balanceOf changes without transfers.",
            bridgeImpact:
                "Standard bridges lock a fixed amount — rebases destroy the 1:1 peg. Requires a wrapper (e.g. wstETH model) before bridging.",
        },
        {
            id: "pausable",
            label: "Pausable Transfers",
            severity: "warning",
            detected: hasPause,
            description:
                "Contract owner can pause all token transfers at any time.",
            bridgeImpact:
                "A paused token halts bridge operations without warning. Wormhole and CCIP cannot process transfers on a paused contract.",
        },
        {
            id: "blacklist",
            label: "Blacklist Mechanism",
            severity: "warning",
            detected: hasBlacklist,
            description:
                "Contract can block specific addresses from sending or receiving tokens.",
            bridgeImpact:
                "The bridge escrow address could be blacklisted post-migration, permanently freezing all bridged assets.",
        },
        {
            id: "upgradeable",
            label: "Upgradeable Proxy",
            severity: "warning",
            detected: hasUpgrade,
            description:
                "Contract logic can be replaced by the admin (EIP-1967 / UUPS / Transparent proxy pattern).",
            bridgeImpact:
                "A malicious upgrade after migration could change token behavior. Verify governance structure and timelock before proceeding.",
        },
        {
            id: "mintable",
            label: "Mintable Supply",
            severity: "info",
            detected: hasMint,
            description:
                "New tokens can be minted, potentially diluting supply indefinitely.",
            bridgeImpact:
                "Uncapped minting on the source chain while supply is locked on Solana can create inflation imbalance. Verify mint authority and schedule.",
        },
        {
            id: "owner_control",
            label: "Active Owner Control",
            severity: "info",
            detected: hasActiveOwner,
            description:
                "Contract retains an active owner address (ownership not renounced).",
            bridgeImpact:
                "Owner actions on the source chain may affect Solana-side compatibility mid-migration. Prefer timelock or DAO governance.",
        },
    ];


    let deduction = 0;
    if (hasFeeTransfer) deduction += 45;
    if (hasRebase) deduction += 40;
    if (hasPause) deduction += 15;
    if (hasBlacklist) deduction += 15;
    if (hasUpgrade) deduction += 12;
    if (hasMint) deduction += 8;
    if (hasActiveOwner) deduction += 5;

    const compatibilityScore = Math.max(0, 100 - deduction);


    const criticals = flags.filter((f) => f.severity === "critical" && f.detected);
    const warnings = flags.filter((f) => f.severity === "warning" && f.detected);

    let overallCompatibility: CompatibilityResult["overallCompatibility"];
    let summary: string;
    let bridgeRecommendation: string;

    if (criticals.length > 0) {
        overallCompatibility = "incompatible";
        const names = criticals.map((f) => f.label).join(" + ");
        summary = `🔴 Critical: ${names}. Standard bridges will fail for this token.`;
        bridgeRecommendation = hasFeeTransfer
            ? "Wrap into a fee-free ERC-20 first, then bridge. Consult Wormhole NTT docs for custom token adapters."
            : hasRebase
                ? "Deploy an elastic-to-fixed wrapper (similar to Lido's wstETH) before bridging. See EIP-4626 wrappers."
                : "Custom bridge infrastructure required. Engage bridge providers directly before committing to migration.";
    } else if (warnings.length > 0 || !isVerified) {
        overallCompatibility = "caution";
        summary = isVerified
            ? `🟡 ${warnings.length} risk flag${warnings.length !== 1 ? "s" : ""} detected. Bridging is technically possible but carries elevated risk.`
            : "🟡 Source code not verified on-chain — cannot fully audit for compatibility issues.";
        bridgeRecommendation =
            "Standard bridges (Wormhole, CCIP) can work. Audit admin key risks, establish governance safeguards, and run a test transfer (< $500) before full migration.";
    } else {
        overallCompatibility = "compatible";
        summary = isVerified
            ? "🟢 No critical incompatibilities detected. Token appears compatible with standard ERC-20 bridge protocols."
            : "🟡 Contract not verified — flags may be incomplete. Always verify source code before bridging at scale.";
        bridgeRecommendation =
            "Proceed with Wormhole NTT or Chainlink CCIP. Run a small validation transfer (< $1K) first to confirm end-to-end accounting.";
    }

    return {
        address,
        chain,
        contractName,
        isVerified,
        isProxy,
        implementationAddress,
        flags,
        overallCompatibility,
        compatibilityScore,
        summary,
        bridgeRecommendation,
    };
}
