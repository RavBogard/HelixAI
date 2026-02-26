import { NextResponse } from "next/server";
import { getAvailableProviders, PROVIDERS } from "@/lib/providers";

export async function GET() {
  const available = getAvailableProviders();
  const all = Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    available: available.some((a) => a.id === p.id),
  }));

  return NextResponse.json({ providers: all });
}
