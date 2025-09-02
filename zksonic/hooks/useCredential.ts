// hooks/useCredential.ts
import { STORAGE } from "@/lib/utils";

export type AgeCredential = {
  type: "AgeCredential";
  subjectDid: string;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
};

export function useCredential() {
  const get = (): AgeCredential | null => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE.vc);
    return raw ? JSON.parse(raw) as AgeCredential : null;
  };

  const set = (c: AgeCredential) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE.vc, JSON.stringify(c));
  };

  const clear = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE.vc);
  };

  return { get, set, clear };
}
