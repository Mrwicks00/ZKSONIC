import * as dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const PRIVATE_KEY = process.env.SONIC_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    // Legacy Blaze Testnet (still works for many folks)
    sonicBlazeTestnet: {
      url: "https://rpc.blaze.soniclabs.com",
      chainId: 14601,
      accounts: [PRIVATE_KEY],
    },
    // Current Sonic Testnet
    sonicTestnet: {
      url: "https://rpc.testnet.soniclabs.com",
      chainId: 14601,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      sonic: process.env.SONICSCAN_API_KEY || "",
      sonicTestnet: process.env.SONICSCAN_TESTNET_API_KEY || "",
    },
    customChains: [
      {
        network: "sonic",
        chainId: 146,
        urls: {
          apiURL: "https://api.sonicscan.org/api",
          browserURL: "https://sonicscan.org",
        },
      },
      {
        network: "sonicTestnet",
        chainId: 14601,
        urls: {
          apiURL: "https://api-testnet.sonicscan.org/api",
          browserURL: "https://testnet.sonicscan.org",
        },
      },
    ],
  },
};

export default config;
