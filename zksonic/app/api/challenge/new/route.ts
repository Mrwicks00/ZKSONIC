// app/api/challenge/new/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const challenge = Math.floor(Math.random() * 1e9); // uint
  const qrData = JSON.stringify({ t: "age18", challenge });
  return NextResponse.json({ challenge, qrData, expiresInSec: 180 });
}
