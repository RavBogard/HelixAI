// src/app/api/map/route.ts
// Lightweight deterministic mapping route — no AI calls, no maxDuration needed.
// Accepts { rigIntent, device } and returns { substitutionMap }.
// Called by page.tsx callMap() after vision extraction to pre-populate SubstitutionCard.
// Called again when the user changes selectedDevice (device re-map useEffect in Phase 21).

import { NextRequest, NextResponse } from "next/server";
import { mapRigToSubstitutions } from "@/lib/rig-mapping";
import type { RigIntent, DeviceTarget } from "@/lib/helix";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { rigIntent?: unknown; device?: unknown };

    // Validate rigIntent presence and basic shape
    if (
      !body.rigIntent ||
      typeof body.rigIntent !== "object" ||
      !Array.isArray((body.rigIntent as Record<string, unknown>).pedals) ||
      (body.rigIntent as { pedals: unknown[] }).pedals.length === 0
    ) {
      return NextResponse.json(
        { error: "rigIntent with a non-empty pedals array is required" },
        { status: 400 }
      );
    }

    // Resolve device — default to "helix_lt" for absent or unrecognised values
    let device: DeviceTarget = "helix_lt";
    if (body.device === "helix_floor") {
      device = "helix_floor";
    } else if (body.device === "pod_go") {
      device = "pod_go";
    } else if (body.device === "helix_stadium") {
      device = "helix_stadium";
    }

    // Safe cast: rigIntent was already Zod-validated by /api/vision before being
    // stored in React state. This route is only called with that validated data.
    const rigIntent = body.rigIntent as RigIntent;
    const substitutionMap = mapRigToSubstitutions(rigIntent, device);

    return NextResponse.json({ substitutionMap });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mapping failed";
    console.error("Rig mapping error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
