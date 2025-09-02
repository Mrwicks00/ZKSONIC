// lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ethers } from "ethers";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const didFromAddress = (addr: string) =>
  `did:zksonic:${addr.toLowerCase()}`;
export const didHash = (did: string) =>
  ethers.keccak256(ethers.toUtf8Bytes(did));

export const todayUTC = () => {
  const d = new Date();
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
};

export const STORAGE = {
  vc: "zksonic.vc.age",
  did: "zksonic.did",
};

export const toBytes32FromNumber = (n: number) =>
  ethers.zeroPadValue(ethers.toBeHex(n), 32);

export const truncateAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
