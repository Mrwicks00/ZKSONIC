// hooks/useDid.ts
import { ethers } from "ethers";
import { ADDRESSES } from "@/lib/addresses";
import { DIDRegistryABI } from "@/lib/abi/DIDRegistry";
import { didFromAddress, didHash, STORAGE } from "@/lib/utils";
import type { WalletClient } from "viem";

export async function registerDidWithWallet(walletClient: WalletClient, didDocumentURI = "") {
  // Convert viem wallet client to ethers provider
  const provider = new ethers.BrowserProvider(walletClient as any);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const did = didFromAddress(address);
  const hash = didHash(did);

  const n = ADDRESSES.sonicTestnet;
  const reg = new ethers.Contract(n.DIDRegistry, DIDRegistryABI, signer);
  const tx = await reg.registerDID(hash, didDocumentURI);
  await tx.wait();

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE.did, did);
  }
  return { did, didHash: hash, txHash: tx.hash };
}

// Check if a DID is registered on-chain
export async function checkDidRegistration(walletClient: WalletClient, address: string) {
  try {
    // Convert viem wallet client to ethers provider
    const ethersProvider = new ethers.BrowserProvider(walletClient as any);
    const did = didFromAddress(address);
    const hash = didHash(did);
    
    const n = ADDRESSES.sonicTestnet;
    const reg = new ethers.Contract(n.DIDRegistry, DIDRegistryABI, ethersProvider);
    
    // Check if DID is registered and not revoked
    const didInfo = await reg.dids(hash);
    const isRegistered = didInfo.owner !== ethers.ZeroAddress && !didInfo.revoked;
    
    if (isRegistered && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE.did, did);
    }
    
    return { isRegistered, did, didInfo };
  } catch (error) {
    console.error('Error checking DID registration:', error);
    return { isRegistered: false, did: null, didInfo: null };
  }
}

export function useDid() {
  const get = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE.did);
  };

  const set = (did: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE.did, did);
  };

  const clear = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE.did);
  };

  return { get, set, clear };
}
