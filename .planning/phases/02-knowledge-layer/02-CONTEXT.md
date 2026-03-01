# Phase 2: Knowledge Layer - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Encode expert Helix knowledge in deterministic code that AI cannot override. Three new modules: `chain-rules.ts` (signal chain ordering + mandatory block insertion), `param-engine.ts` (category-specific amp/cab/effect parameter values), `snapshot-engine.ts` (volume-balanced snapshot scene generation). These consume ToneIntent from Phase 1 and produce a complete PresetSpec ready for `buildHlxFile()`.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All Phase 2 decisions are delegated to Claude. The user trusts the builder's judgment on:

- **Signal chain order** — Enforce: Gate → Boost → Amp → Cab → EQ → Mod → Delay → Reverb. DSP0 gets pre-amp blocks (gate, boost/drive, amp, cab). DSP1 gets post-cab blocks (EQ, mod, delay, reverb, volume). chain-rules.ts inserts mandatory blocks (boost, post-cab EQ, noise gate) without AI involvement.
- **Always-on boost implementation** — Minotaur (Klon) for clean/crunch, Scream 808 for high-gain. Inserted by chain-rules.ts if not already in ToneIntent effects list. Parameters set by param-engine.ts per amp category.
- **Amp parameter defaults** — Category-specific expert defaults from FEATURES.md research (Tonevault 250 presets analysis): clean (Master 0.9-1.0, Drive 0.2-0.3, SAG 0.5-0.7), crunch (Master 0.5-0.7, Drive 0.4-0.6, SAG 0.4-0.5), high-gain (Master 0.3-0.6, Drive 0.3-0.5, SAG 0.2-0.3). Topology-aware mid EQ.
- **Cab filtering** — Every cab gets LowCut 80-100 Hz, HighCut 5000-8000 Hz. Mic selection by category: 121 Ribbon for clean, 57 Dynamic for high-gain, blend rules for crunch.
- **Post-cab EQ** — Parametric EQ after cab on every preset. Anti-mud cut at 300-500 Hz, presence recovery high shelf +0.5-1.5 dB at 6-8 kHz.
- **Snapshot design** — 4 snapshots (Clean, Rhythm, Lead, Ambient). Volume-balanced via ChVol overrides only (never Master). Lead gets +2-3 dB via Volume block. LED colors: Clean=blue(6), Rhythm=orange(2), Lead=red(1), Ambient=turquoise(5). Delay/reverb trails enabled.
- **Dynamic responsiveness** — Low Drive + high Master ratio for volume-knob cleanup. SAG set appropriately per category. Boost architecture enables dynamic response.
- **DSP split rules** — Max 8 non-cab blocks per DSP. Amp+cab always on DSP0. Post-cab effects on DSP1.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — all implementation details follow the research-backed consensus from `.planning/research/FEATURES.md` and `.planning/research/ARCHITECTURE.md`. Focus on encoding expert knowledge as deterministic rules, not heuristics.

</specifics>

<code_context>
## Existing Code Insights

### Phase 1 Foundation (completed, available to build on)
- `src/lib/helix/types.ts`: AmpCategory, TopologyTag, CabSize types; HlxCab with required LowCut/HighCut; PresetSpec, BlockSpec, SnapshotSpec contracts
- `src/lib/helix/models.ts`: 68 AMP_MODELS with ampCategory, topology, cabAffinity metadata; 22 CAB_MODELS with Hz defaults; BLOCK_TYPES verified; LED_COLORS; CONTROLLERS
- `src/lib/helix/tone-intent.ts`: ToneIntentSchema (Zod) — ampName, cabName, guitarType, genreHint, effects[], snapshots[], tempoHint
- `src/lib/helix/param-registry.ts`: PARAM_TYPE_REGISTRY distinguishing hz_value, integer_index, normalized_float, db_value, bpm, boolean_int
- `src/lib/helix/index.ts`: Barrel exports for all Phase 1 additions

### Established Patterns
- HelixModel interface: `{ id, name, basedOn, category, ampCategory, topology, cabAffinity, defaultParams, blockType }`
- `defaultParams` on each amp model already has per-model starting points — param-engine will layer category overrides on top
- BLOCK_TYPES constant verified against 15 real .hlx exports
- validate.ts has type-aware parameter clamping (Hz for cab LowCut/HighCut, integer for Mic, normalized for everything else)
- preset-builder.ts buildHlxFile() converts PresetSpec → HlxFile JSON with proper snapshot controllers and footswitch assignments

### Integration Points
- chain-rules.ts will read from AMP_MODELS and CAB_MODELS to resolve ToneIntent model names to model IDs
- param-engine.ts will read from AMP_MODELS defaultParams + category overrides to produce final parameter values
- snapshot-engine.ts will consume the BlockSpec[] output from chain-rules + param-engine to generate SnapshotSpec[]
- Output: complete PresetSpec ready for existing buildHlxFile()

</code_context>

<deferred>
## Deferred Ideas

- Pickup-aware tone calibration (v2 — TONE-V2-01)
- Dual cab / dual mic blending (v2 — TONE-V2-02)
- Genre-specific signal chain templates (v2 — TONE-V2-03)
- Snapshots 5-8 extended scenes (v2 — SNAP-V2-01)

</deferred>

---

*Phase: 02-knowledge-layer*
*Context gathered: 2026-03-01*
