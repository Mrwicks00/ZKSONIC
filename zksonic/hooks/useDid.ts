// hooks/useDid.ts
import { ethers } from "ethers";
import { ADDRESSES } from "@/lib/addresses";
import { DIDRegistryABI } from "@/lib/abi/DIDRegistry";
import { didFromAddress, didHash, STORAGE } from "@/lib/utils";

export async function registerDidWithWallet(provider: any, didDocumentURI = "") {
  const ethersProvider = new ethers.BrowserProvider(provider);
  const signer = await ethersProvider.getSigner();
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
