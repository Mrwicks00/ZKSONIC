// lib/addresses.ts
export const ADDRESSES = {
  sonicTestnet: {
    chainId: 14601,
    rpcUrl: "https://rpc.testnet.soniclabs.com",
    DIDRegistry: "0x631f7E66e9caB44205A5bb2323A2f919de4e903A",
    CredentialIssuer: "0x58227D11c784Bc5B5a18d97F886e8d4129EBA7C5",
    Groth16Verifier: "0xdA74e203BCeaa601749304b84BF289119BcED03D",
    AgeGate: "0xcBFb34c4BF995448262C7A7eb3D1Ae5Eb2Fd4342",
  },
} as const;

export type NetworkKey = keyof typeof ADDRESSES;
export const DEFAULT_NETWORK: NetworkKey = "sonicTestnet";
