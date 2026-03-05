# Phase 54: Stadium Device Unblock - Research

**Researched:** 2026-03-05
**Domain:** API guard removal + end-to-end Stadium integration testing
**Confidence:** HIGH

## Summary

Phase 54 is a guarded production unblock, not a feature build. The guard being removed is a single `return NextResponse.json(..., { status: 400 })` early-exit in `src/app/api/generate/route.ts` (lines 37-41). Once that early return is deleted, the code path falls straight through to the existing Stadium generation logic: `buildHspFile()` is already called when `isStadium(deviceTarget)` is true at line 158, persistence to Supabase is already wired, and the file extension `.hsp` is already returned. The Stadium button is also visually blocked in the UI (page.tsx lines 1338 and 1433) with an italic "temporarily unavailable" note — that text and the STADIUM device being absent from both device picker arrays also needs to be removed.

The critical dependency is Phase 53 (stadium-builder.ts rebuild). The research phase here confirms what REQUIREMENTS.md, STATE.md, and SUMMARY.md all agree on: this phase is entirely an acceptance gate, not an implementation. The work is (1) remove the API guard, (2) add STADIUM to the device picker UI, (3) run end-to-end generation tests producing real .hsp files, (4) verify those files open correctly in HX Edit and produce musically sensible parameters. If Phase 53 shipped correctly, Phase 54 should be low-risk. The risk in this phase is entirely a Phase 53 residue risk — catching anything Phase 53 missed.

One important current finding: the `STADIUM_DEVICE_VERSION` constant in `config.ts` is still `285213946` (the pre-research value). The SUMMARY.md research confirmed the correct value from real .hsp files is `301990015`. This is a STAD-02 requirement that belongs in Phase 52 — but if it was not completed in Phase 52 or 53, Phase 54 will surface this when HX Edit imports fail. The planner must check whether Phase 52/53 actually updated this constant before removing the guard. Additionally, the `access: "enabled"` field in slot params at `stadium-builder.ts:343` was identified in SUMMARY.md as a format bug (real files do NOT have the `access` field on slot params) — the Phase 53 builder rebuild must have corrected this before Phase 54 proceeds.

**Primary recommendation:** Before removing the guard, do a one-time pre-flight check of 3 specific constants: `STADIUM_DEVICE_VERSION` in `config.ts` (must be 301990015), slot param format in `stadium-builder.ts` `buildFlowBlock()` (must be `{ value: X }` only, no `access` field), and block slot positions for amp/cab (must use fixed grid positions, not sequential `flowPos`). If all three pass, remove the guard and run the success criteria battery.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STAD-08 | Stadium device selection unblocked in UI after hardware verification passes | Guard location confirmed at `src/app/api/generate/route.ts` lines 37-41; UI block at `src/app/page.tsx` lines 1338, 1433 and both device picker arrays; hardware verification must precede removal |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | API route hosting | Existing — no change |
| TypeScript | 5 | Type safety | Existing — no change |
| Vitest | ^4.0.18 | Unit testing | Existing test runner used in all 4 test files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase | existing | Storage persistence (.hsp upload) | Already wired — no changes needed |
| HX Edit | firmware 1.2.x | Hardware verification tool | Manual verification gate — not in code |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual HX Edit verification | Automated binary parser | Manual is the correct gate — no automated parser exists or is needed for this phase |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/api/generate/route.ts   # Remove Stadium 400 guard (lines 37-41)
├── app/page.tsx                # Add STADIUM to both device picker arrays; remove "unavailable" notes
└── lib/helix/
    ├── config.ts               # Verify STADIUM_DEVICE_VERSION = 301990015 (pre-flight check only)
    └── stadium-builder.ts      # Verify slot param format (pre-flight check only)
```

### Pattern 1: Guard Removal
**What:** Delete the early-return block that returns HTTP 400 for `helix_stadium` device. The surrounding code already handles Stadium correctly via the `isStadium(deviceTarget)` branch at line 158.
**When to use:** After Phase 53 pre-flight checks pass.
**Example:**
```typescript
// REMOVE these lines from src/app/api/generate/route.ts (lines ~37-41):
} else if (device === "helix_stadium") {
  return NextResponse.json(
    { error: "Stadium support is temporarily unavailable. Please select a different device." },
    { status: 400 }
  );
}

// REPLACE with:
} else if (device === "helix_stadium") {
  deviceTarget = "helix_stadium";
}
```

### Pattern 2: UI Device Picker Addition
**What:** Add the STADIUM device to both device picker arrays in `page.tsx`. There are two separate pickers: the rig-emulation flow (around line 1311) and the chat flow (around line 1413). Both currently have STADIUM absent from their option arrays and show an "unavailable" message below the grid.
**When to use:** Same commit as the API guard removal.
**Example:**
```typescript
// ADD to both device picker arrays in page.tsx:
{ id: "helix_stadium" as const, label: "STADIUM", desc: "Helix Stadium" },

// REMOVE from both locations:
<span className="text-[10px] text-[var(--hlx-text-muted)] italic">
  Stadium support temporarily unavailable — we hope to bring it back soon
</span>
```

### Pattern 3: Pre-Flight Verification (before any code change)
**What:** Read three specific code locations to confirm Phase 52/53 landed their changes correctly.
**When to use:** First task in this phase — gates everything else.

Location 1 — `src/lib/helix/config.ts`, `STADIUM_DEVICE_VERSION`:
```typescript
// Must be: 301990015 (verified from real .hsp files per SUMMARY.md)
// If still: 285213946 — Phase 52 did not complete STAD-02; fix before unblocking
STADIUM_DEVICE_VERSION: 301990015,
```

Location 2 — `src/lib/helix/stadium-builder.ts`, `buildFlowBlock()`:
```typescript
// Slot params must be: { value: X } only — NO access field
// If still: { access: "enabled", value: X } — Phase 53 did not fix STAD-03; do not unblock
slotParams[key] = { value };   // correct
slotParams[key] = { access: "enabled", value };  // wrong — Phase 53 incomplete
```

Location 3 — `src/lib/helix/stadium-builder.ts`, amp/cab block slot positions:
```typescript
// Amp must land at b05, Cab at b06 (fixed grid positions per SUMMARY.md)
// If still using sequential flowPos counter — Phase 53 did not fix STAD-04; do not unblock
```

### Anti-Patterns to Avoid
- **Removing the guard before verifying Phase 53 completeness:** The guard exists precisely because the builder was broken. Removing it without confirming the three critical bugs are fixed would expose users to corrupt .hsp files.
- **Only testing TypeScript compilation as acceptance:** `tsc --noEmit` passing does not mean HX Edit can load the file. Hardware or HX Edit import verification is the actual acceptance gate.
- **Testing with only one tone goal:** Amp parameters failing to be musically sensible is a subtle bug that may not show on a single clean-tone test. The success criteria require 5-10 varied requests.
- **Forgetting the second device picker:** There are two places in `page.tsx` where the Stadium button is absent. Only adding it to the chat flow picker and leaving it absent from the rig-emulation flow picker would create an inconsistent UI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| .hsp format validation | Custom binary validator | Open generated file in HX Edit | HX Edit is the ground truth; code validator cannot substitute for firmware acceptance |
| Stadium acceptance test harness | Automated e2e test | Manual 5-10 generation + HX Edit import | The acceptance criterion is hardware behavior, not code behavior |

**Key insight:** This phase's acceptance gate is a human action (open file in HX Edit), not a code assertion. No amount of TypeScript correctness confirms firmware compatibility — only the firmware itself does.

## Common Pitfalls

### Pitfall 1: Phase 53 Residue — `access` Field Still Present
**What goes wrong:** Generated .hsp files fail to load in HX Edit with a JSON schema error or silent import failure.
**Why it happens:** `stadium-builder.ts` `buildFlowBlock()` at line ~343 was building `{ access: "enabled", value: X }` for all slot params. If Phase 53 did not fix this to `{ value: X }` only, every generated preset will have malformed parameters.
**How to avoid:** Pre-flight check: read `buildFlowBlock()` and confirm the slot params object has NO `access` field before removing the API guard.
**Warning signs:** HX Edit import succeeds structurally but all effect parameters are at wrong values; or HX Edit shows import error on parameter schema.

### Pitfall 2: Wrong Device Version Constant
**What goes wrong:** HX Edit may reject the preset or assign it to the wrong device category if `device_version` in the meta block is wrong.
**Why it happens:** `STADIUM_DEVICE_VERSION` in `config.ts` was `285213946` at research time. The correct value confirmed from real .hsp files is `301990015`. Phase 52 was supposed to fix this (STAD-02). If Phase 52 did not complete, the constant is still wrong.
**How to avoid:** Pre-flight check: read `config.ts` and confirm `STADIUM_DEVICE_VERSION` is `301990015`.
**Warning signs:** HX Edit imports the file but shows an unexpected firmware version warning, or the preset appears in the wrong device category.

### Pitfall 3: Sequential Block Keys Instead of Fixed Grid Positions
**What goes wrong:** HX Edit shows blocks in incorrect positions or signal routing is wrong in the visual editor. Hardware routing failures possible.
**Why it happens:** The pre-Phase-53 builder used a sequential `flowPos` counter, so blocks landed at b01, b02, b03 regardless of type. Real Stadium firmware expects the amp at b05 and cab at b06. Phase 53 (STAD-04) was supposed to fix this.
**How to avoid:** Pre-flight check: inspect `buildStadiumFlow()` in `stadium-builder.ts` and confirm amp blocks go to b05 and cab blocks go to b06, not just whatever `flowPos` happens to be.
**Warning signs:** Generated preset loads in HX Edit but the signal chain visualization shows amp and cab in unexpected positions; effects placed before the amp position.

### Pitfall 4: Testing Only "Happy Path" Tone Goals
**What goes wrong:** The 400 guard is removed, a single clean-tone test generates successfully, and the phase is marked complete — but a high-gain request later fails because Agoura high-gain amp defaultParams are wrong or missing.
**Why it happens:** Success criteria require 5-10 varied requests. Cutting this short risks missing amp-specific parameter bugs that only surface for certain amp categories.
**How to avoid:** Test at minimum: 1 clean (e.g., "warm Fender-style clean"), 1 crunch (e.g., "mid-gain Marshall blues"), 1 high-gain (e.g., "aggressive modern metal"), 1 ambient (time-based effects heavy), 1 variation on each.
**Warning signs:** First test passes, rest are not run before phase is declared complete.

### Pitfall 5: Snapshot State Mismatch Masking as Success
**What goes wrong:** HX Edit loads the preset but snapshot panels show incorrect block states (all ON or all OFF when they should be mixed). The preset "loads without error" but the snapshot names or enabled states do not match what the UI shows.
**Why it happens:** The `buildBlockEnabled()` function in `stadium-builder.ts` builds the `@enabled.snapshots` array — this requires snapshot `blockStates` to be correctly populated by the snapshot engine for Stadium. Success criterion 4 explicitly requires verifying snapshot names and block states in HX Edit's snapshot panel.
**How to avoid:** After generating a preset, open it in HX Edit, switch between snapshots, and confirm block enabled states change as expected and snapshot names match what was generated.

## Code Examples

Verified from direct codebase inspection:

### Guard Location (exact)
```typescript
// src/app/api/generate/route.ts lines 36-42
} else if (device === "helix_stadium") {
  return NextResponse.json(
    { error: "Stadium support is temporarily unavailable. Please select a different device." },
    { status: 400 }
  );
}
// Replace with: } else if (device === "helix_stadium") { deviceTarget = "helix_stadium"; }
```

### UI Picker Location (rig-emulation flow, around line 1311)
```typescript
// src/app/page.tsx ~line 1311 — rig-emulation device picker array
// Currently missing "helix_stadium". Add after helix_floor or helix_stomp_xl:
{ id: "helix_stadium" as const, label: "STADIUM", desc: "Helix Stadium" },
// Then remove the col-span-3 "unavailable" span below the grid (~line 1338)
```

### UI Picker Location (chat flow, around line 1413)
```typescript
// src/app/page.tsx ~line 1413 — chat flow device picker array
// Same as above — currently missing "helix_stadium"
// Add same entry; remove unavailable message (~line 1433)
```

### Stadium Branch Already Wired (no changes needed)
```typescript
// src/app/api/generate/route.ts lines 158-205
if (isStadium(deviceTarget)) {
  const hspFile = buildHspFile(presetSpec);        // Already calls stadium-builder
  const summary = summarizeStadiumPreset(presetSpec);
  // Persistence: uploads to `${user.id}/${conversationId}/latest.hsp`
  // Returns: { preset: hspFile.json, summary, spec, toneIntent, device, fileExtension: ".hsp" }
}
```

### Pre-Flight Check — Slot Params (should look like this after Phase 53)
```typescript
// src/lib/helix/stadium-builder.ts buildFlowBlock() ~line 342
// CORRECT (Phase 53 complete):
slotParams[key] = { value };
// WRONG (Phase 53 incomplete — do not unblock):
slotParams[key] = { access: "enabled", value };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stadium 400 guard (v3.2) | Guard removed (v4.0 Phase 54) | Phase 54 | Users can select Stadium in UI |
| Stadium "unavailable" UI note | STADIUM added to device picker | Phase 54 | Stadium button appears and is clickable |

**Deprecated/outdated:**
- The 400 guard: added in v3.2 as a temporary block when the builder was found to be broken. Not permanent infrastructure — it is literally a placeholder for this phase.
- The "temporarily unavailable" UI spans: added at same time. Not styling — they are explicit placeholder text.

## Open Questions

1. **Did Phase 52 update `STADIUM_DEVICE_VERSION` to 301990015?**
   - What we know: The value at research time is `285213946` in `config.ts`. REQUIREMENTS.md STAD-02 maps this to Phase 52.
   - What's unclear: Whether Phase 52 has completed by the time this phase begins.
   - Recommendation: Make the pre-flight check the first task. If the constant is wrong, fix it in this phase before removing the guard (it is a one-line change to `config.ts`).

2. **Did Phase 53 remove the `access` field from slot params?**
   - What we know: `buildFlowBlock()` at line ~343 currently emits `{ access: "enabled", value }`. SUMMARY.md identifies this as Bug 1 (STAD-03), assigned to Phase 53.
   - What's unclear: Whether Phase 53 has completed and fixed this by the time this phase begins.
   - Recommendation: Pre-flight check the slot params format in `buildFlowBlock()`. If `access` is still present, fix it before removing the guard — this is a critical format bug that will cause HX Edit import failures.

3. **What are the 6 missing Agoura amp IDs from Phase 52?**
   - What we know: SUMMARY.md lists `Agoura_AmpRevvCh3Purple`, `Agoura_AmpSolid100`, `Agoura_AmpUSDoubleBlack`, `Agoura_AmpUSLuxeBlack`, `Agoura_AmpUSPrincess76`, `Agoura_AmpUSTweedman` as missing. Phase 52 (STAD-01) was supposed to add these.
   - What's unclear: Whether Phase 52 completed adding these with correct `defaultParams`.
   - Recommendation: After removing the guard, if AI selects one of these amp names and it throws a "Unknown amp model" error in chain-rules, it confirms Phase 52 is incomplete. Pre-flight check: count entries in `STADIUM_AMPS` — should have 18 entries if Phase 52 completed.

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` (the key does not exist). Treating as false — skipping formal Validation Architecture section.

However, the existing test infrastructure is relevant context for the planner:

**Test framework:** Vitest ^4.0.18, config at `vitest.config.ts`, run with `npx vitest run`.

**Existing Stadium test coverage:**
- `chain-rules.test.ts` lines 415-440: Two Stadium tests — one confirms Agoura_* model IDs are produced, one confirms HD2-only amps throw for Stadium device.
- `orchestration.test.ts` lines 304, 315: Device ID uniqueness and `isStomp` exclusion for Stadium.
- No existing test for `buildHspFile()` output structure or `validatePresetSpec()` Stadium path.

**Wave 0 gaps (if planner wants automated coverage):**
- `src/lib/helix/stadium-builder.test.ts` — test `buildHspFile()` output structure: magic header, meta device_id/device_version, flow array length, b00 input block, b13 output block, slot params without `access` field, snapshot count.
- The success criteria (5-10 manual HX Edit verification runs) cannot be automated. They are explicitly manual gate tasks.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/app/api/generate/route.ts` — guard at lines 36-42, Stadium branch at lines 158-205 (verified 2026-03-05)
- Direct codebase inspection: `src/app/page.tsx` — "unavailable" spans at lines 1338, 1433; STADIUM absent from device picker arrays at ~lines 1311 and 1413 (verified 2026-03-05)
- Direct codebase inspection: `src/lib/helix/stadium-builder.ts` — `buildFlowBlock()` slot param format at line ~343; current `access` field bug still present (verified 2026-03-05)
- Direct codebase inspection: `src/lib/helix/config.ts` — `STADIUM_DEVICE_VERSION: 285213946` (needs to be 301990015 per SUMMARY.md) (verified 2026-03-05)
- `.planning/research/SUMMARY.md` — Architecture section confirms Stadium bug locations, Phase 45 description confirms "single line removal guarded by explicit acceptance criteria" (HIGH confidence, written from real .hsp inspection)
- `.planning/REQUIREMENTS.md` — STAD-08 requirement text and Phase 54 traceability
- `.planning/ROADMAP.md` Phase 54 section — success criteria, dependencies, plans TBD
- `.planning/STATE.md` — "Phase 45 (Unblock): Single line removal guarded by explicit acceptance criteria; the risk is entirely in Phase 44, not here"

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` Pitfalls section — "Stadium builder produces presets that compile but fail on hardware" — pre-flight check pattern derived from this
- `src/lib/helix/chain-rules.test.ts` lines 415-440 — existing Stadium test patterns for reference

### Tertiary (LOW confidence)
- None — all findings are from direct codebase inspection or project documents.

## Metadata

**Confidence breakdown:**
- Guard location: HIGH — exact file and line numbers confirmed by direct read
- UI block location: HIGH — exact file and line numbers confirmed by direct read
- Pre-flight checks: HIGH — constants and format bugs confirmed from codebase + SUMMARY.md
- Phase 52/53 completion status: LOW — cannot be known until those phases execute; addressed as open questions
- HX Edit acceptance behavior: MEDIUM — inferred from SUMMARY.md real .hsp analysis; cannot be programmatically verified

**Research date:** 2026-03-05
**Valid until:** Valid until Phase 53 completes (no external dependencies change)
