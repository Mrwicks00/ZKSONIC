// hooks/useProof.ts
import { todayUTC } from "@/lib/utils";

export type GenerateProofResp = {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  input: string[]; // uint[5] as hex strings
  publicSignals: string[];
};

export async function generateProof(credential: {
  birthYear: number; 
  birthMonth: number; 
  birthDay: number;
}, challenge: number) {
  const d = todayUTC();
  const res = await fetch("/api/generate-proof", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      birthYear: credential.birthYear,
      birthMonth: credential.birthMonth,
      birthDay: credential.birthDay,
      currentYear: d.year,
      currentMonth: d.month,
      currentDay: d.day,
      challenge
    })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<GenerateProofResp>;
}

export async function verifyOnChain(params: {
  a: any; 
  b: any; 
  c: any; 
  input: any; 
  challenge: number; 
  did: string;
}) {
  const res = await fetch("/api/verify-proof", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      a: params.a, 
      b: params.b, 
      c: params.c, 
      input: params.input,
      challengeNumber: params.challenge,
      did: params.did
    })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean; txHash?: string }>;
}
