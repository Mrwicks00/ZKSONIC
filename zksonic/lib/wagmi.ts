// lib/wagmi.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sonicTestnet } from "wagmi/chains";
import { ADDRESSES } from "./addresses";

export const config = getDefaultConfig({
  appName: "ZKSONIC",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "your-project-id",
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
