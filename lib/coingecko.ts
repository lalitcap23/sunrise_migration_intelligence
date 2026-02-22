import Coingecko from "@coingecko/coingecko-typescript";

// Single reusable Demo API client — server-side only
export const geckoClient = new Coingecko({
  demoAPIKey: process.env.COINGECKO_DEMO_API_KEY,
  environment: "demo",
  maxRetries: 3,
});

// Map our chain IDs → CoinGecko asset platform IDs
export const PLATFORM_MAP: Record<string, string> = {
  ethereum: "ethereum",
  bsc: "binance-smart-chain",
  polygon: "polygon-pos",
};
