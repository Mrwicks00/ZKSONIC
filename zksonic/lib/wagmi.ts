// lib/wagmi.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ADDRESSES } from "./addresses";

// Define Sonic Testnet manually
const sonicTestnet = {
  id: 14601,
  name: "Sonic Testnet",
  nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.soniclabs.com"] },
  },
  blockExplorers: {
    default: { name: "SonicScan", url: "https://testnet.sonicscan.org" },
  },
  testnet: true,
} as const;

export const config = getDefaultConfig({
  appName: "ZKSONIC",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "your-project-id",
  chains: [sonicTestnet],
  ssr: true,
});
