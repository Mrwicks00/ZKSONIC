// app/api/generate-proof/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const {
      birthYear,
      birthMonth,
      birthDay,
      currentYear,
      currentMonth,
      currentDay,
      challenge,
    } = await req.json();

    const { groth16 } = (await import("snarkjs")) as any;
    const WASM = path.join(process.cwd(), "public/age_proof_js/age_proof.wasm");
    const ZKEY = path.join(process.cwd(), "public/age_proof_0001.zkey");

    const { proof, publicSignals } = await groth16.fullProve(
      {
        birthYear,
        birthMonth,
        birthDay,
        currentYear,
        currentMonth,
        currentDay,
        challenge,
      },
      WASM,
      ZKEY
    );

    const calldata = await (groth16 as any).exportSolidityCallData(
      proof,
      publicSignals
    );
    const argv = JSON.parse("[" + calldata + "]");

    // conforms to uint[2], uint[2][2], uint[2], uint[5]
    const a = [argv[0][0], argv[0][1]];
    const b = [
      [argv[1][0][0], argv[1][0][1]],
      [argv[1][1][0], argv[1][1][1]],
    ];
    const c = [argv[2][0], argv[2][1]];
    const input = argv[3];

    return NextResponse.json({ a, b, c, input, publicSignals });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || String(e) },
      { status: 400 }
    );
  }
}
