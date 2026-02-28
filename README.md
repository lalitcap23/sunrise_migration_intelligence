# ☀️ sunrise_migration_intelligence

**Token Migration Readiness Analyzer for Solana** — evaluate any ERC-20 token using real-time data, scored assessments, and strategy recommendations.

---

## What It Does

Enter a token address and get:

- **Readiness Score** (0–100) across demand, market presence, liquidity, and bridge risk
- **Dump Risk Score** — whale concentration, supply unlocks, bearish momentum
- **Contract Compatibility** — 7-flag scan for bridge-breaking patterns (fee-on-transfer, rebase, proxy, etc.)
- **Migration Strategy** — one of 4 recommended approaches based on the score profile
- **Solana Pool Simulation** — post-migration slippage at $1K–$1M batch sizes
- **IPFS Archival** — pin reports permanently via Pinata

### Pages

| Page | Description |
|---|---|
| `/analyze` | Core analysis dashboard |
| `/tokens` | Top tokens by chain, one-click analyze |
| `/compare` | Side-by-side comparison (up to 4 tokens) with radar chart + CSV export |
| `/reports` | Saved IPFS report archive |

---

## Tech Stack

Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS v4 · Recharts · Zod · Axios  
APIs: CoinGecko · Etherscan V2 · DeFiLlama · Wormhole Scan · Pinata (IPFS)

---

## Quick Start

```bash
git clone https://github.com/your-org/sunrise.git
cd sunrise
npm install
```

Then put  `.env`:

```env


```bash
npm run dev
# → http://localhost:3000
```

---

## Supported Chains

Ethereum · Polygon

---

## License

MIT
