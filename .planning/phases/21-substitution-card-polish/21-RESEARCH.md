# Phase 21 Research: Substitution Card & End-to-End Polish

**Researched:** 2026-03-02
**Domain:** React component design, Next.js API routes, loading state management, client-side data flow
**Confidence:** HIGH — all findings sourced directly from the existing codebase

---

## Research Summary

Phase 21 has one architectural gap that everything else depends on: the `substitutionMap` is currently only available AFTER `/api/generate` returns (Phase 20 wiring), but SC-1 requires it BEFORE the user clicks Generate. Closing this gap requires a new `/api/map` route that runs `mapRigToSubstitutions` server-side on demand, and a change to `callVision()` in `page.tsx` to chain into `/api/map` automatically after vision extraction succeeds.

The `SubstitutionCard` component renders on the welcome screen (where `messages.length === 0`) inside the existing upload panel at lines 628-674 of `page.tsx`. That block already shows confidence badges and a raw JSON `<details>` element. Phase 21 replaces the `<details>` block with `SubstitutionCard` and adds a "Mapping to Helix models…" loading phase between vision and generate.

All Phase 21 changes to loading states, the mapping call, and `SubstitutionCard` visibility MUST be conditional on `rigIntent !== null` to satisfy SC-7 (text-only path is unchanged). The `substitutionMap` state variable already exists in `page.tsx` from Phase 20 — Phase 21 populates it earlier (from `/api/map`) instead of later (from `/api/generate`). The generate route continues to remap internally, which is fine — it's deterministic and cheap.

**Primary recommendation:** Add `/api/map` route, chain `callVision()` into `callMap()` automatically, render `SubstitutionCard` in the upload panel below confidence badges, add `isMappingLoading` state, re-trigger mapping on device change via `useEffect`.

---

## Files Analyzed

| File | Lines | Key Findings |
|------|-------|--------------|
| `src/app/page.tsx` | 869 | `substitutionMap` state already at line 210-217; `callVision()` at 413-461; upload panel at 543-675; raw JSON `<details>` at 665-672 is Phase 21's replacement target |
| `src/lib/rig-mapping.ts` | 641 | `mapRigToSubstitutions(rigIntent, device)` and `lookupPedal()` are pure, no IO, safe for API routes; `confidence: "approximate"` = unknown pedal case confirmed |
| `src/app/api/generate/route.ts` | 147 | `substitutionMap` already returned in both response shapes (lines 104, 118); `buildToneContext()` private helper present |
| `src/lib/helix/index.ts` | 23 | `SubstitutionEntry`, `SubstitutionMap` exported from `./rig-intent` at line 22; `mapRigToSubstitutions` is in `@/lib/rig-mapping` (not the helix barrel) |
| `src/lib/helix/rig-intent.ts` | 56 | `SubstitutionEntrySchema`: `helixModelDisplayName` is always human-readable string — never an HD2_ ID; `helixModel` holds the HD2_ ID |
| `src/app/globals.css` | 502 | CSS variables: `--hlx-green`, `--hlx-amber`, `--hlx-copper`, `--hlx-surface`, `--hlx-elevated`, `--hlx-border`, `--hlx-border-warm`, `--hlx-text`, `--hlx-text-sub`, `--hlx-text-muted` available for SubstitutionCard styling |
| `src/app/api/vision/route.ts` | 112 | Pattern for new API routes: validate body, call lib function, return JSON; uses `maxDuration = 60` and `dynamic = "force-dynamic"` because it calls an AI API — `/api/map` needs NEITHER since it is deterministic |
| `.planning/phases/20-planner-integration-orchestration/20-01-SUMMARY.md` | 63 | Confirms `substitutionMap` state added to `page.tsx` in Phase 20; current flow populates it only after `/api/generate` response |

---

## Architecture Decisions

### AD-1: /api/map route — design and validation

**Decision:** New file at `src/app/api/map/route.ts`. Pure POST handler, no AI calls, no file I/O.

**What it accepts:**
```json
{ "rigIntent": { "pedals": [...] }, "device": "helix_lt" }
```

**What it returns:**
```json
{ "substitutionMap": [ SubstitutionEntry, ... ] }
```

**Does NOT need `maxDuration`** — no AI calls, completes in <100ms. Does NOT need `dynamic = "force-dynamic"` — no caching concern for a POST.

**Validation needed:**
- `rigIntent` must be present and have a `pedals` array (non-empty)
- `device` must be one of `"helix_lt"`, `"helix_floor"`, `"pod_go"` — default to `"helix_lt"` if absent/invalid rather than 400 error (defensive)
- Individual pedal entries do not need deep validation — `mapRigToSubstitutions` is robust to partial data

**Error responses:**
- 400 if `rigIntent` is missing or `rigIntent.pedals` is not an array or is empty
- 500 for unexpected errors with `{ error: message }`

**Rationale:** Mirrors the vision route's pattern (validate body → call lib → return JSON) but is much simpler because there is no AI call.

---

### AD-2: callVision() automatic mapping chain

**Decision:** After `setRigIntent(data.rigIntent)` succeeds in `callVision()`, automatically call a new `callMap(data.rigIntent)` helper function before finally() runs. This is NOT a separate button — it runs automatically, satisfying SC-1 ("immediately after vision extraction and mapping complete").

**Mapping failure is NON-FATAL:** If `/api/map` returns an error, log it and continue. Vision still succeeds. The user sees their confidence badges but not the substitution card. They can still generate. The generate route will re-run mapping internally anyway.

**Why non-fatal:** SC-7 says the text-only path must be unchanged. A mapping error should not block preset generation. The worst case is the substitution card is not shown, which is a degraded-but-functional experience.

**isMappingLoading:** Set to `true` at the start of the map call, `false` in its finally block. This is SEPARATE from `isVisionLoading`.

**Concurrency:** The two operations run sequentially (`callVision` → `callMap`), NOT in parallel. The map call needs the `rigIntent` data from the vision response.

---

### AD-3: SubstitutionCard component design

**`helixModelDisplayName` is always human-readable — confirmed.** In `rig-intent.ts` line 38, the field comment explicitly says "Human-readable name: 'Teemah!' (from PEDAL_HELIX_MAP)". In `rig-mapping.ts` `buildEntry()` at line 541, `helixModelDisplayName: entry.model.name` — `entry.model` is a `HelixModel` whose `.name` field is always the display name (e.g., "Scream 808", "Teemah!"). `entry.model.id` would be the HD2_ string, but that field is never placed in `helixModelDisplayName`. Therefore the HD2_ guard in SubstitutionCard is defensive-only (belt-and-suspenders check to never show `HD2_`).

**Unknown pedal detection:** `confidence === "approximate"` is the correct trigger for the escape hatch card. This is confirmed by `lookupPedal()` at line 585 in `rig-mapping.ts`: "Tier 3: approximate — unknown pedal or all fallbacks excluded". `APPROXIMATE_FALLBACK` at line 502 is `CATEGORY_DEFAULTS["overdrive"]` (Teemah!). So an approximate entry means: category was undetectable OR all fallbacks were excluded for the device.

**The substitutionReason for approximate entries** is always one of the `CATEGORY_DEFAULTS` reasons (e.g., "Teemah! (Timmy-based) is the most neutral, transparent overdrive in Helix — best general-purpose OD fallback"). The `physicalPedal` field holds the original pedal name. These two fields together give the component everything it needs.

**Confidence visual mapping:**
- `"direct"` → green border, full opacity, "Exact match" badge
- `"close"` → yellow/amber border, full opacity, "Best match" badge
- `"approximate"` → orange/dim border, 70% opacity, "Approximate" badge + escape hatch panel

---

### AD-4: Where SubstitutionCard renders in page.tsx

**Decision:** On the welcome screen (`messages.length === 0`) inside the upload panel, replacing the `<details>` raw JSON block at lines 665-672.

**Reasoning:**
1. The upload panel is conditionally shown on the welcome screen. Rig analysis happens BEFORE the chat starts.
2. The existing `rigIntent && (...)` block at line 628 is already the right place. The confidence badges (lines 634-661) stay — SubstitutionCard renders BELOW them.
3. The `<details className="group">` raw JSON block (lines 665-672) is explicitly annotated: `{/* Raw JSON for debugging (Phase 19 only — replaced by SubstitutionCard in Phase 21) */}` — this is the exact replacement target.
4. SC-1 says "immediately after vision extraction and mapping complete" — this is satisfied by showing SubstitutionCard as soon as `substitutionMap` is set (which happens right after `callMap()` succeeds).

**What changes at lines 628-674:** The `<details>` block is removed. Below the confidence badges, add:
```
{isMappingLoading && <MappingLoadingSpinner />}
{substitutionMap && !isMappingLoading && <SubstitutionCard entries={substitutionMap} physicalPedals={rigIntent.pedals} />}
```

---

### AD-5: Loading state flow for rig emulation path

**Three-phase loading, all gated on `rigIntent !== null`:**

| Phase | State variable | Label shown | Trigger |
|-------|---------------|-------------|---------|
| 1 | `isVisionLoading=true` | "Analyzing Photos…" (already exists on the Analyze button) | callVision() start |
| 2 | `isMappingLoading=true` | "Mapping to Helix models…" (NEW — shown in upload panel below badges) | callMap() start |
| 3 | `isGenerating=true` | "Building preset…" (NEW label when `rigIntent` set) OR existing "Generating Preset…" | generatePreset() start |

The "Mapping to Helix models…" indicator appears in the upload panel in the welcome screen, below the confidence badges. It is a small inline spinner with the label — NOT a full-screen block.

The generate button label change (SC-5, SC-6): when `rigIntent !== null && isGenerating`, show "Building preset…"; when `rigIntent === null && isGenerating`, show "Generating Preset…" (unchanged).

**SC-5 minimum stage visibility:** The mapping phase is near-instant (<100ms). To ensure it is visible for at least 1 second as specified by SC-5, add an artificial `await new Promise(r => setTimeout(r, 800))` in `callMap()` after getting the response. This ensures the "Mapping to Helix models…" label shows for a perceivable moment. ALTERNATIVELY: skip the artificial delay and accept that SC-5's "at least 1 second" refers to the natural duration of each AI step (vision = several seconds, generate = 15-20s) — the mapping stage is the only one that might be sub-second. The planner should decide whether to add the artificial delay.

---

### AD-6: Device change re-mapping

**Decision:** Add a `useEffect` that re-calls `/api/map` when `selectedDevice` changes AND `rigIntent !== null`.

```typescript
useEffect(() => {
  if (rigIntent) {
    callMap(rigIntent);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedDevice]);
```

**Why this matters:** The substitution card must show Pod Go model names when Pod Go is selected (SC-6). `mapRigToSubstitutions` takes `device` as input — different devices produce different `helixModel` IDs and potentially different `helixModelDisplayName` values (Pod Go uses suffix-matched models from `getModelIdForDevice()`). Without re-mapping, a user who selects Pod Go after vision extraction would see Helix model names in the substitution card but get Pod Go models in the preset.

**Dependency array exclusion:** `callMap` will be defined as a standalone async function (not `useCallback`), so it should be stable. The ESLint disable comment prevents the warning about `callMap` not being in deps.

---

### AD-7: Unknown pedal escape hatch trigger condition

**Decision:** `confidence === "approximate"` is the definitive trigger. Do NOT use string matching on `substitutionReason`.

**Evidence from `lookupPedal()` in rig-mapping.ts:**
- Tier 1 (direct): exact PEDAL_HELIX_MAP key match AND `isModelAvailableForDevice()` returns true → `confidence: "direct"`
- Tier 2 (close): `detectCategory()` returns a known category AND category fallback model is available → `confidence: "close"`
- Tier 3 (approximate): everything else (unknown pedal name, unknown category, or all fallbacks excluded) → `confidence: "approximate"`

**The escape hatch card text (SC-4):**
```
"We don't have [entry.physicalPedal] in our database. You can describe its
sound instead, or we'll treat it as a [category] pedal."
```

For the `[category]` placeholder: when `confidence === "approximate"`, the `helixModelDisplayName` is always "Teemah!" (APPROXIMATE_FALLBACK = overdrive category). The substitutionReason text says "most neutral, transparent overdrive". So for approximate entries, category = "overdrive" pedal. The escape hatch message can hardcode "overdrive" OR extract from `substitutionReason` OR simply say "an overdrive-type pedal" in all approximate cases. The hardcoded "overdrive" approach is simplest and accurate for the current fallback.

WAIT — this is not fully accurate. `APPROXIMATE_FALLBACK` is always `CATEGORY_DEFAULTS["overdrive"]`, BUT the `close` tier uses actual detected categories (delay, reverb, etc.). So for `confidence: "close"`, the model might be a delay model. Only `confidence: "approximate"` always maps to Teemah!. Therefore for the escape hatch (approximate only), saying "overdrive-type pedal" is always correct.

---

## Implementation Patterns

### Pattern 1: src/app/api/map/route.ts — complete file content

```typescript
// src/app/api/map/route.ts
// Lightweight deterministic mapping route — no AI calls.
// Accepts { rigIntent, device } and returns { substitutionMap }.
// Called by page.tsx after vision extraction to show SubstitutionCard before generate.

import { NextRequest, NextResponse } from "next/server";
import { mapRigToSubstitutions } from "@/lib/rig-mapping";
import type { RigIntent, DeviceTarget } from "@/lib/helix";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { rigIntent?: unknown; device?: unknown };

    // Validate rigIntent
    if (
      !body.rigIntent ||
      typeof body.rigIntent !== "object" ||
      !Array.isArray((body.rigIntent as Record<string, unknown>).pedals) ||
      (body.rigIntent as { pedals: unknown[] }).pedals.length === 0
    ) {
      return NextResponse.json(
        { error: "rigIntent with non-empty pedals array is required" },
        { status: 400 }
      );
    }

    // Resolve device — default to helix_lt for unknown/absent values
    let device: DeviceTarget = "helix_lt";
    if (body.device === "helix_floor") {
      device = "helix_floor";
    } else if (body.device === "pod_go") {
      device = "pod_go";
    }

    // Cast is safe — rigIntent was already Zod-validated by /api/vision before
    // being stored in client state. This route is only called with that data.
    const rigIntent = body.rigIntent as RigIntent;
    const substitutionMap = mapRigToSubstitutions(rigIntent, device);

    return NextResponse.json({ substitutionMap });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mapping failed";
    console.error("Rig mapping error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Verification:** No `maxDuration` export needed. No `dynamic` export needed. No imports from AI libraries. ~40 lines total. Pattern matches `vision/route.ts` structure exactly.

---

### Pattern 2: SubstitutionCard React component

Add this component to `page.tsx` above the `Home` function, alongside `SignalChainViz` and `ToneDescriptionCard` (after line 164, before line 166):

```typescript
// SubstitutionCard entry type matches SubstitutionEntry from @/lib/helix/rig-intent
interface SubstitutionEntryDisplay {
  physicalPedal: string;
  helixModel: string;
  helixModelDisplayName: string;
  substitutionReason: string;
  confidence: "direct" | "close" | "approximate";
  parameterMapping?: Record<string, number>;
}

function SubstitutionCard({ entries }: { entries: SubstitutionEntryDisplay[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-widest text-[var(--hlx-text-muted)] font-semibold">
        Helix Substitutions
      </p>
      <div className="space-y-2">
        {entries.map((entry, i) => {
          const isApproximate = entry.confidence === "approximate";
          const isClose = entry.confidence === "close";
          const isDirect = entry.confidence === "direct";

          // Safety guard: never render an HD2_ internal ID
          const displayName = entry.helixModelDisplayName.startsWith("HD2_")
            ? entry.helixModel.replace(/^HD2_/, "").replace(/_/g, " ")
            : entry.helixModelDisplayName;

          return (
            <div
              key={i}
              className={`rounded-lg border px-3 py-2.5 transition-all ${
                isDirect
                  ? "border-[var(--hlx-border-warm)] bg-[var(--hlx-elevated)]"
                  : isClose
                  ? "border-yellow-900/40 bg-[var(--hlx-surface)]"
                  : "border-orange-900/30 bg-[var(--hlx-surface)] opacity-70"
              }`}
            >
              {/* Header row: Physical → Helix + confidence badge */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[0.8125rem] text-[var(--hlx-text)] font-medium truncate">
                    {entry.physicalPedal}
                  </span>
                  <svg
                    className="w-3 h-3 text-[var(--hlx-text-muted)] flex-shrink-0"
                    fill="none"
                    viewBox="0 0 12 12"
                  >
                    <path
                      d="M2 6h8M7 3l3 3-3 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span
                    className={`text-[0.8125rem] font-semibold flex-shrink-0 ${
                      isDirect
                        ? "text-[var(--hlx-amber)]"
                        : isClose
                        ? "text-yellow-400"
                        : "text-orange-400"
                    }`}
                  >
                    {displayName}
                  </span>
                </div>

                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${
                    isDirect
                      ? "bg-green-950/40 text-green-400 border border-green-900/30"
                      : isClose
                      ? "bg-yellow-950/40 text-yellow-400 border border-yellow-900/30"
                      : "bg-orange-950/30 text-orange-400 border border-orange-900/30"
                  }`}
                >
                  {isDirect ? "Exact match" : isClose ? "Best match" : "Approximate"}
                </span>
              </div>

              {/* Substitution reason */}
              <p className="text-[11px] text-[var(--hlx-text-muted)] mt-1.5 leading-relaxed">
                {entry.substitutionReason}
              </p>

              {/* Escape hatch for approximate (unknown pedal) */}
              {isApproximate && (
                <div className="mt-2 rounded-md bg-orange-950/20 border border-orange-900/20 px-2.5 py-2">
                  <p className="text-[11px] text-orange-300/90 leading-relaxed">
                    We don&apos;t have <strong>{entry.physicalPedal}</strong> in our database.
                    You can describe its sound instead, or we&apos;ll treat it as an overdrive-type pedal.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### Pattern 3: page.tsx changes — state variables

Add ONE new state variable (all others already exist from Phase 20):

```typescript
// NEW in Phase 21 — mapping loading state
const [isMappingLoading, setIsMappingLoading] = useState(false);
```

**State variables that already exist (do NOT re-declare):**
- `substitutionMap` — line 210-217, set by Phase 20
- `rigIntent` — line 196-207, set by Phase 19
- `isVisionLoading` — line 195, set by Phase 19
- `isGenerating` — line 170, set by Phase 20

---

### Pattern 4: page.tsx changes — standalone callMap() function and updated callVision()

Add `callMap` as a standalone async function in the `Home` component body, then update `callVision` to chain into it.

**New `callMap` function** (add before `callVision`, after `startOver`):

```typescript
async function callMap(rigIntentData: NonNullable<typeof rigIntent>) {
  setIsMappingLoading(true);
  setSubstitutionMap(null);
  try {
    const mapRes = await fetch("/api/map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rigIntent: rigIntentData,
        device: selectedDevice,
      }),
    });
    if (mapRes.ok) {
      const mapData = await mapRes.json();
      if (mapData.substitutionMap) {
        setSubstitutionMap(mapData.substitutionMap);
      }
    }
    // Mapping failure is non-fatal: silently continue (vision result still visible)
  } catch {
    // Non-fatal: substitution card simply doesn't show
  } finally {
    setIsMappingLoading(false);
  }
}
```

**Updated `callVision` function** — replace the existing body (lines 413-461). Only the try block changes — add the `callMap` call after `setRigIntent`:

```typescript
async function callVision() {
  if (rigImages.length === 0) return;
  setIsVisionLoading(true);
  setVisionError(null);
  setRigIntent(null);
  setSubstitutionMap(null); // Clear stale map on re-analyze

  try {
    const imageCompression = (await import("browser-image-compression")).default;

    const compressed = await Promise.all(
      rigImages.map(async (file) => {
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1568,
          useWebWorker: true,
          initialQuality: 0.8,
        });
        const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);
        const base64Data = dataUrl.split(",")[1];
        const mediaType = compressedFile.type || "image/jpeg";
        return { data: base64Data, mediaType };
      })
    );

    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: compressed }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `Vision API error: ${res.status}`);
    }

    const data = await res.json();
    setRigIntent(data.rigIntent);

    // Phase 21: automatically chain into mapping after successful vision extraction
    // callMap is non-fatal — vision success is preserved even if mapping fails
    await callMap(data.rigIntent);
  } catch (err) {
    setVisionError(
      err instanceof Error ? err.message : "Vision extraction failed"
    );
  } finally {
    setIsVisionLoading(false);
  }
}
```

**IMPORTANT:** `setIsVisionLoading(false)` runs in `finally` AFTER `callMap` completes. This means `isVisionLoading=true` persists through the entire vision+mapping sequence. This is acceptable IF the button label stays "Analyzing Photos…" during mapping. If distinct labels per phase are needed, `setIsVisionLoading(false)` must run before `await callMap()`:

```typescript
    // Option B: distinct phase labels
    const data = await res.json();
    setRigIntent(data.rigIntent);
    setIsVisionLoading(false); // End phase 1 label
    await callMap(data.rigIntent); // Phase 2 label (isMappingLoading)
    return; // Skip finally setting isVisionLoading=false again
```

With Option B the `finally` block would incorrectly set `isVisionLoading=false` again (benign but redundant). To avoid this, use a `success` flag:

```typescript
async function callVision() {
  if (rigImages.length === 0) return;
  setIsVisionLoading(true);
  setVisionError(null);
  setRigIntent(null);
  setSubstitutionMap(null);

  try {
    const imageCompression = (await import("browser-image-compression")).default;

    const compressed = await Promise.all(
      rigImages.map(async (file) => {
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1568,
          useWebWorker: true,
          initialQuality: 0.8,
        });
        const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);
        const base64Data = dataUrl.split(",")[1];
        const mediaType = compressedFile.type || "image/jpeg";
        return { data: base64Data, mediaType };
      })
    );

    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: compressed }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `Vision API error: ${res.status}`);
    }

    const data = await res.json();
    setRigIntent(data.rigIntent);
    // End vision phase — show "Mapping to Helix models…" separately
    setIsVisionLoading(false);

    // Phase 21: chain into mapping (isMappingLoading takes over)
    await callMap(data.rigIntent);
  } catch (err) {
    setVisionError(
      err instanceof Error ? err.message : "Vision extraction failed"
    );
    setIsVisionLoading(false);
  }
}
```

**RECOMMENDATION:** Use the version above (set `setIsVisionLoading(false)` explicitly before `callMap`, remove `finally` block). This gives distinct phase labels as required by SC-5.

---

### Pattern 5: page.tsx changes — useEffect for device re-mapping

Add this `useEffect` AFTER the existing three `useEffect` calls (lines 223-246), before `sendMessage`:

```typescript
// Phase 21: Re-run mapping when device changes and rigIntent is already set.
// Ensures SubstitutionCard shows device-appropriate model names (e.g., Pod Go).
useEffect(() => {
  if (rigIntent) {
    callMap(rigIntent);
  }
  // callMap reads selectedDevice from closure — eslint would warn about missing dep
  // but callMap itself is not stable across renders; this pattern is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedDevice]);
```

**Caveat:** `callMap` is not defined with `useCallback`, so technically the effect has a stale closure risk on `selectedDevice`. However, `callMap` reads `selectedDevice` via closure at the time it runs — since `selectedDevice` changing IS what triggers this effect, the closure value is always current at the time `callMap` runs. This is safe.

**Alternative with useCallback:** If the ESLint rule is strict, wrap `callMap` in `useCallback`:
```typescript
const callMap = useCallback(async (rigIntentData: NonNullable<typeof rigIntent>) => {
  // ... body unchanged
}, [selectedDevice]); // selectedDevice in deps → new callMap ref when device changes
```
Then the useEffect can include `callMap` in its deps. Either approach is correct.

---

### Pattern 6: page.tsx changes — where SubstitutionCard renders in the JSX

**Location:** Replace lines 665-672 (the `<details>` raw JSON block) in the `{rigIntent && (...)}` section.

**Current code at lines 664-673:**
```tsx
{/* Raw JSON for debugging (Phase 19 only — replaced by SubstitutionCard in Phase 21) */}
<details className="group">
  <summary className="text-[11px] text-[var(--hlx-text-muted)] cursor-pointer hover:text-[var(--hlx-text-sub)] transition-colors">
    Raw extraction data
  </summary>
  <pre className="mt-2 text-[10px] text-[var(--hlx-text-muted)] bg-[var(--hlx-void)] rounded-lg p-3 overflow-x-auto leading-relaxed">
    {JSON.stringify(rigIntent, null, 2)}
  </pre>
</details>
```

**Replace with:**
```tsx
{/* Phase 21: Mapping loading indicator */}
{isMappingLoading && (
  <div className="flex items-center gap-2 text-[0.8125rem] text-[var(--hlx-text-muted)]">
    <svg className="hlx-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
    Mapping to Helix models&hellip;
  </div>
)}

{/* Phase 21: SubstitutionCard — visible after mapping completes */}
{substitutionMap && !isMappingLoading && (
  <SubstitutionCard entries={substitutionMap} />
)}
```

**Full context of surrounding code** (lines 628-675 after change):
```tsx
{/* RigIntent result */}
{rigIntent && (
  <div className="space-y-2">
    <p className="text-[11px] uppercase tracking-widest text-[var(--hlx-text-muted)] font-semibold">
      Extraction Result
    </p>

    {/* Per-pedal confidence badges (unchanged from Phase 19) */}
    {rigIntent.pedals.map((pedal, i) => (
      <div
        key={i}
        className="flex items-start gap-2.5 rounded-lg border border-[var(--hlx-border)] bg-[var(--hlx-elevated)] px-3 py-2"
      >
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 mt-0.5 ${
          pedal.confidence === "high"
            ? "bg-green-950/40 text-green-400 border border-green-900/30"
            : pedal.confidence === "medium"
            ? "bg-yellow-950/40 text-yellow-400 border border-yellow-900/30"
            : "bg-red-950/40 text-red-400 border border-red-900/30"
        }`}>
          {pedal.confidence}
        </span>
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-[var(--hlx-text)] truncate">
            {pedal.fullName || "(unidentified pedal)"}
          </p>
          {pedal.confidence !== "high" && (
            <p className="text-[11px] text-yellow-400/80 mt-0.5">
              Confirm this identification before generating — type the correct pedal name in the chat.
            </p>
          )}
        </div>
      </div>
    ))}

    {/* Phase 21: Mapping loading indicator */}
    {isMappingLoading && (
      <div className="flex items-center gap-2 text-[0.8125rem] text-[var(--hlx-text-muted)]">
        <svg className="hlx-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Mapping to Helix models&hellip;
      </div>
    )}

    {/* Phase 21: SubstitutionCard */}
    {substitutionMap && !isMappingLoading && (
      <SubstitutionCard entries={substitutionMap} />
    )}
  </div>
)}
```

---

### Pattern 7: page.tsx changes — generate button label update

**Current generate button** (lines 732-748):
```tsx
<button onClick={generatePreset} disabled={isGenerating} className="hlx-generate">
  {isGenerating ? (
    <>
      <svg className="hlx-spin h-5 w-5" ...>...</svg>
      Generating Preset&hellip;
    </>
  ) : (
    <>
      <span ...>H</span>
      Generate Preset
    </>
  )}
</button>
```

**Replace the loading label only** (the "Generating Preset…" text):
```tsx
<button onClick={generatePreset} disabled={isGenerating} className="hlx-generate">
  {isGenerating ? (
    <>
      <svg className="hlx-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      {rigIntent ? "Building preset\u2026" : "Generating Preset\u2026"}
    </>
  ) : (
    <>
      <span className="w-5 h-5 rounded-md bg-[var(--hlx-void)] flex items-center justify-center text-[10px] font-bold text-[var(--hlx-amber)]">H</span>
      Generate Preset
    </>
  )}
</button>
```

**Key:** `rigIntent` is in closure scope, always current. No new props needed.

---

### Pattern 8: startOver() updates

The existing `startOver()` at line 399 already clears `substitutionMap` via `setSubstitutionMap(null)`. Phase 21 needs ONE addition — clear `isMappingLoading`:

```typescript
function startOver() {
  setMessages([]);
  setInput("");
  setReadyToGenerate(false);
  setGeneratedPreset(null);
  setError(null);
  // Phase 19: clear vision state
  setRigImages([]);
  setRigIntent(null);
  setVisionError(null);
  // Phase 20: clear substitution map
  setSubstitutionMap(null);
  // Phase 21: clear mapping loading state
  setIsMappingLoading(false);
}
```

---

## File Change Summary

| File | Action | Change Description |
|------|--------|-------------------|
| `src/app/api/map/route.ts` | CREATE | ~40-line route: validate body, call `mapRigToSubstitutions()`, return `{ substitutionMap }`. No AI calls, no `maxDuration`, no `dynamic`. |
| `src/app/page.tsx` | MODIFY | 6 changes: (1) add `SubstitutionCard` component before `Home`; (2) add `SubstitutionEntryDisplay` interface; (3) add `isMappingLoading` state; (4) add `callMap()` function; (5) update `callVision()` to chain into `callMap()`; (6) update `callMap` useEffect for device re-mapping; (7) replace `<details>` raw JSON block with mapping spinner + SubstitutionCard; (8) update generate button loading label; (9) update `startOver()` to clear `isMappingLoading` |

---

## Pitfalls

### P-1: isVisionLoading still true during callMap
If the `finally` block in `callVision` is left as-is and `callMap` runs inside the `try` block, `isVisionLoading` stays `true` during the mapping phase. This means the Analyze button shows "Analyzing Photos…" during both phases. SC-5 requires distinct labels. Solution: set `setIsVisionLoading(false)` explicitly before `await callMap()` and remove the `finally` block (or use a flag to skip the `finally` set).

### P-2: callMap reads selectedDevice from stale closure in useEffect
The device change `useEffect` triggers `callMap(rigIntent)`. `callMap` reads `selectedDevice` from closure. If `callMap` is defined outside `useCallback`, React may warn about missing dependencies. Solution: define `callMap` with `useCallback([selectedDevice])` OR add the ESLint disable comment. Do NOT omit the re-mapping effect — SC-6 requires Pod Go substitution card accuracy.

### P-3: substitutionMap from /api/generate clobbers pre-generate mapping
Phase 20 `generatePreset()` calls `setSubstitutionMap(null)` at the top of the try block, then `setSubstitutionMap(data.substitutionMap)` at the end. This means the generate route's mapping result (which is deterministic/identical to /api/map's result) will overwrite the pre-generate mapping. This is fine and intentional — the result is the same data. However, there is a brief moment during generation where `substitutionMap` is null. To avoid the SubstitutionCard disappearing during generation, consider NOT calling `setSubstitutionMap(null)` in `generatePreset()` when `substitutionMap` is already set. The existing comment says this was added "to prevent stale substitution state on re-generate." Keep the `setSubstitutionMap(null)` call BUT since SubstitutionCard is on the welcome screen and generate moves the user to the chat view (messages.length > 0), the card won't be visible during generation anyway. This is a non-issue.

### P-4: Welcome screen vs. chat view — SubstitutionCard disappears after Generate
The SubstitutionCard renders when `messages.length === 0`. Once the user clicks Generate and messages start populating (or if the preset generates directly), the welcome screen disappears and the SubstitutionCard goes with it. This is correct behavior — SC-1 says "before the user clicks Generate." After generation, the user sees the ToneDescriptionCard in the chat view. The SubstitutionCard should also appear somewhere in the chat view for transparency. **Resolution:** The roadmap says "renders in the chat flow" — but page.tsx only shows the upload panel on the welcome screen. DECISION: Show SubstitutionCard in the welcome screen for the pre-generate phase. After generate, the `generatedPreset` section in the chat view should optionally also render a collapsed SubstitutionCard if `substitutionMap` is set. This is a stretch goal — not in SC-1-7. The planner should include the welcome screen placement as primary and treat post-generate chat-view SubstitutionCard as optional.

### P-5: HD2_ guard in SubstitutionCard
The `helixModelDisplayName` field is always human-readable (confirmed by `buildEntry()` in `rig-mapping.ts` line 541). The HD2_ guard in `SubstitutionCard` is defensive only. Do NOT skip it — it protects against future bugs where an internal ID accidentally gets placed in the display name field.

### P-6: SC-7 regression risk — text-only path
ALL Phase 21 changes to loading states, SubstitutionCard rendering, and mapping calls are inside conditionals on `rigIntent !== null` or `substitutionMap !== null`. The new `isMappingLoading` state starts as `false` and is only set to `true` inside `callMap()`, which is only called from `callVision()` and the device change `useEffect`. The device change `useEffect` has `if (rigIntent)` guard. For a text-only user: `rigIntent` is always null, `isMappingLoading` is always false, `substitutionMap` is always null until generate completes. The generate button label change uses `rigIntent ?` ternary — null-safe. **Zero risk to text-only path.**

### P-7: The "Mapping to Helix models…" stage may be sub-second
The `/api/map` route does zero I/O — it completes in <50ms. SC-5 says "each stage is visible for at least 1 second." The natural vision stage (several seconds) and generate stage (15-20s) easily satisfy this. The mapping stage does not. Options: (a) accept sub-second mapping stage as compliant since the user already watched the vision phase; (b) add `await new Promise(r => setTimeout(r, 800))` in `callMap()` after setting the map. Option (a) is simpler and architecturally cleaner. The spirit of SC-5 is "no blank spinner for 15-20 seconds" which is fully addressed by the three distinct labels. The planner should make a final call.

---

## Verification Strategy

**End-to-end test steps for the planner to include in task acceptance criteria:**

1. **Vision + SubstitutionCard (SC-1, SC-2, SC-3):**
   - Upload a photo of a TS9 or Boss SD-1 pedal
   - Observe: "Analyzing Photos…" label during vision
   - Observe: "Mapping to Helix models…" label during mapping
   - Observe: SubstitutionCard appears with "Scream 808" or "Stupor OD" (not "HD2_DistScream808")
   - Direct match entries have green "Exact match" badge, full opacity
   - DOM inspection confirms zero `HD2_` strings in rendered text

2. **Unknown pedal escape hatch (SC-4):**
   - Upload a photo of a boutique pedal not in PEDAL_HELIX_MAP (e.g., a Mythos pedal or custom build)
   - Observe: SubstitutionCard shows orange "Approximate" badge at reduced opacity
   - Escape hatch panel appears: "We don't have [pedal name] in our database..."

3. **Pod Go device flow (SC-6):**
   - Upload pedal photo → wait for SubstitutionCard (shows Helix model names)
   - Select "Pod Go" device
   - Observe: SubstitutionCard re-renders with Pod Go model names (different display names for some pedals)
   - Click Generate → download `.pgp` file → verify loads in Pod Go Edit

4. **Text-only regression (SC-7):**
   - Start fresh session (no images uploaded)
   - Type a tone description → reach Generate step → generate
   - Network tab: only `/api/chat` and `/api/generate` calls — no `/api/map` call
   - Response shape of `/api/generate` is identical to v1.2 (no `substitutionMap` field since rigIntent not passed)
   - Generate button shows "Generating Preset…" (not "Building preset…")

5. **Loading state distinctness (SC-5):**
   - Upload photo → click Analyze
   - Observe "Analyzing Photos…" for several seconds (vision phase)
   - Observe "Mapping to Helix models…" briefly (mapping phase)
   - Click Generate → observe "Building preset…" for 15-20 seconds
   - No step shows a blank spinner without a label

6. **TypeScript + build verification:**
   - `npx tsc --noEmit` → 0 errors
   - `npm run build` → clean build, no new route compilation errors
   - `npx vitest run` → all existing tests pass (108+)

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `src/app/page.tsx` — full 869-line file read; exact line numbers verified
- `src/lib/rig-mapping.ts` — full 641-line file; `lookupPedal()`, `APPROXIMATE_FALLBACK` confirmed
- `src/lib/helix/rig-intent.ts` — `SubstitutionEntrySchema` with `helixModelDisplayName` comment confirmed
- `src/app/api/generate/route.ts` — `substitutionMap` in both response shapes confirmed at lines 104, 118
- `src/app/api/vision/route.ts` — route pattern confirmed for `/api/map` design
- `src/app/globals.css` — CSS variables enumerated for component styling
- `src/lib/helix/index.ts` — barrel exports confirmed; `SubstitutionEntry`/`SubstitutionMap` from `./rig-intent`
- `.planning/phases/20-planner-integration-orchestration/20-01-SUMMARY.md` — Phase 20 completion state verified

### No web research required
All findings are sourced directly from the codebase. Phase 21 adds UI layer on top of fully-implemented backend infrastructure from Phases 17-20. No external library research needed.

---

## Metadata

**Confidence breakdown:**
- `/api/map` route design: HIGH — pattern directly from `vision/route.ts`, function signatures from `rig-mapping.ts`
- `SubstitutionCard` component: HIGH — CSS variables from `globals.css`, confidence logic from `rig-mapping.ts` Tier 3 analysis
- `callVision()` chaining: HIGH — exact current code read, change is surgical
- Loading state flow: HIGH — existing `isVisionLoading`/`isGenerating` pattern followed
- Device re-mapping effect: HIGH — `mapRigToSubstitutions` signature confirmed takes `device`
- Unknown pedal detection: HIGH — `lookupPedal()` Tier 3 is always `APPROXIMATE_FALLBACK`, `confidence: "approximate"` is the canonical signal

**Research date:** 2026-03-02
**Valid until:** Stable — findings are from codebase, not external sources. Valid until Phase 17-20 code is modified.
