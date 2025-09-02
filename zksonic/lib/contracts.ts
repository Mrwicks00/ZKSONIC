// lib/contracts.ts
import { ethers } from "ethers";
import { ADDRESSES, DEFAULT_NETWORK } from "./addresses";
import {
  AgeGateABI,
  Groth16VerifierABI,
  DIDRegistryABI,
  CredentialIssuerABI,
} from "./abi";

export function getServerProvider(network = DEFAULT_NETWORK) {
  const rpc = ADDRESSES[network].rpcUrl;
  return new ethers.JsonRpcProvider(rpc);
}

export function getServerWallet(network = DEFAULT_NETWORK) {
  const pk = process.env.SONIC_PRIVATE_KEY!;
  if (!pk) throw new Error("Missing SONIC_PRIVATE_KEY in env.");
  return new ethers.Wallet(pk, getServerProvider(network));
}

export function getContracts(signerOrProvider?: ethers.Signer | ethers.Provider, network = DEFAULT_NETWORK) {
  const n = ADDRESSES[network];
  const p = signerOrProvider ?? getServerProvider(network);
  const ageGate = new ethers.Contract(n.AgeGate, AgeGateABI, p);
  const verifier = new ethers.Contract(n.Groth16Verifier, Groth16VerifierABI, p);
  const didRegistry = new ethers.Contract(n.DIDRegistry, DIDRegistryABI, p);
  const credentialIssuer = new ethers.Contract(n.CredentialIssuer, CredentialIssuerABI, p);
  return { ageGate, verifier, didRegistry, credentialIssuer };
}
