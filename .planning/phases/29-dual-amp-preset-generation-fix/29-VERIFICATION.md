---
phase: 29-dual-amp-preset-generation-fix
status: passed
verified: 2026-03-03
verifier: claude-opus-4.6
---

# Phase 29: Dual-Amp Preset Generation Fix — Verification

## Phase Goal
Users who request presets with two different amps receive a valid dual-amp preset with split/join AB topology, per-snapshot amp switching, and independent parameter resolution — single-amp presets are completely unaffected; Pod Go gracefully falls back to single-amp.

## Requirement Verification

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| DUAL-01 | ToneIntentSchema adds optional secondAmpName/secondCabName with Zod validation | PASS | `src/lib/helix/tone-intent.ts` — z.enum(AMP_NAMES).optional() fields with .refine() validation |
| DUAL-02 | Planner prompt documents dual-amp fields, usage, and DSP budget | PASS | `src/lib/planner.ts` — secondAmpName/secondCabName docs, dual-amp rules section |
| DUAL-03 | Chain assembler builds split/join AB topology for Helix dual-amp | PASS | `src/lib/helix/chain-rules.ts` — isDualAmp detection, two amp+cab pairs on path 0/1 |
| DUAL-04 | Param engine resolves second amp independently | PASS | `src/lib/helix/param-engine.ts` — secondAmpCategory/secondTopology for path-1 blocks |
| DUAL-05 | Snapshot engine per-snapshot bypass toggle with ChVol | PASS | `src/lib/helix/snapshot-engine.ts` — clean/crunch enable primary, lead/ambient enable secondary |
| DUAL-06 | Preset builder @topology0: "AB" and split/join blocks | PASS | `src/lib/helix/preset-builder.ts` — HD2_SplitAB, HD2_MergerMixer, path-aware cab refs |
| DUAL-07 | Pod Go guard silently ignores secondAmpName | PASS | `chain-rules.ts` — isDualAmp=false when podGo, `planner.ts` — device restriction |
| DUAL-08 | Gemini prompt describes dual-amp for Helix and Pod Go limitation | PASS | `src/lib/gemini.ts` — dual-amp capability + Pod Go limitation lines |
| DUAL-09 | Generated .hlx structurally valid with runtime validation | PASS | `preset-builder.ts` — topology, split/join, and amp path validation assertions |

## Must-Have Checks

### Automated Checks
- [x] `npx tsc --noEmit` — zero TypeScript errors across entire project
- [x] ToneIntentSchema.optional() fields — single-amp parsing unaffected
- [x] .refine() enforces secondCabName when secondAmpName present
- [x] buildPlannerPrompt() with Pod Go device includes restriction text
- [x] buildPlannerPrompt() with Helix device includes dual-amp rules (no Pod Go restriction)
- [x] getSystemPrompt() contains "dual-amp" and "Pod Go does NOT support dual-amp"
- [x] assembleSignalChain() with secondAmpName produces chain with path 0 and path 1 amp blocks
- [x] assembleSignalChain() ignores secondAmpName when isPodGo
- [x] resolveParameters() uses secondAmpCategory for path-1 blocks
- [x] buildSnapshots() toggles amp bypass per snapshot role
- [x] buildHlxFile() validates topology, split, join, and amp paths for dual-amp

### Single-Amp Regression
- [x] ToneIntentSchema without secondAmpName parses identically to pre-Phase 29
- [x] assembleSignalChain() without secondAmpName produces same output as before
- [x] buildHlxFile() without dual-amp produces @topology0: "A" (no split/join)

## Artifacts Verified

| File | Contains | Verified |
|------|----------|----------|
| src/lib/helix/tone-intent.ts | secondAmpName, secondCabName, .refine() | Yes |
| src/lib/planner.ts | secondAmpName docs, dual-amp rules, Pod Go guard | Yes |
| src/lib/gemini.ts | dual-amp description, Pod Go limitation | Yes |
| src/lib/helix/chain-rules.ts | isDualAmp, secondAmpModel, path 1 assignment | Yes |
| src/lib/helix/param-engine.ts | secondAmpCategory, path-1 resolution | Yes |
| src/lib/helix/snapshot-engine.ts | primaryAmpEntry, secondaryAmpEntry, bypass toggle | Yes |
| src/lib/helix/preset-builder.ts | AB topology, HD2_SplitAB, HD2_MergerMixer, validation | Yes |

## Score: 9/9 requirements verified

## Result: PASSED
