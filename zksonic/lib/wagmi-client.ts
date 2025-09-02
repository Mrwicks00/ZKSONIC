// lib/wagmi-client.ts
"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ADDRESSES } from "./addresses";

// Define Sonic Testnet manually since wagmi's version has wrong chain ID
const sonicTestnet = {
  id: 14601,
  name: "Sonic Testnet",
  nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.soniclabs.com"] },
    public: { http: ["https://rpc.testnet.soniclabs.com"] },
  },
  blockExplorers: {
    default: { name: "SonicScan", url: "https://testnet.sonicscan.org" },
  },
  testnet: true,
} as const;

export const config = getDefaultConfig({
  appName: "ZKSONIC",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "1f2e3d4c5b6a7980",
  chains: [
    {
      ...sonicTestnet,
      id: ADDRESSES.sonicTestnet.chainId,
      rpcUrls: {
        default: { http: [ADDRESSES.sonicTestnet.rpcUrl] },
        public: { http: [ADDRESSES.sonicTestnet.rpcUrl] },
      },
    },
  ],
  ssr: true,
});
