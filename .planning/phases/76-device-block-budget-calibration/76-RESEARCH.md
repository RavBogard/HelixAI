# Phase 76: Device Block Budget Calibration - Research

**Researched:** 2026-03-06
**Domain:** Line 6 Helix device capabilities, DSP block budgets, signal chain assembly
**Confidence:** HIGH

## Summary

The codebase has artificially conservative `maxEffectsPerDsp` values across most device families, causing the AI planner to generate fewer effects than the hardware supports and chain-rules to silently truncate effects that the planner does generate. The root cause is a misunderstanding of what `maxEffectsPerDsp` should represent: it was set to conservative values during initial implementation and never calibrated against actual hardware block budgets.

The most severe issue is Stadium, where `maxEffectsPerDsp=4` silently truncates effects even though the stadium-builder.ts defines 12 block slots (b01-b12) with b05=amp and b06=cab, giving 10 user-effect positions. Chain-rules truncates to 4, then mandatory blocks (EQ + volume) consume 2 of those 4, leaving only 2 user effects. For Helix, the prompt tells the AI "up to 6 effects" but the Zod schema also caps at `.max(6)` while real users routinely use 8+ effects across dual DSPs. For Stomp, `maxEffectsPerDsp=2` is far too low -- the hardware supports 8 total blocks (since FW 3.0), and with amp+cab taking 2, that leaves 6 user-effect slots.

**Primary recommendation:** Raise `maxEffectsPerDsp` to match actual hardware user-effect capacity, raise the Zod schema `.max(6)` to `.max(10)`, update all prompt maxEffects values to match, and add a `console.warn` when chain-rules truncates effects.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUDGET-01 | DeviceCapabilities `maxEffectsPerDsp` matches real hardware user-effect slot count for ALL families | Complete hardware block budget analysis below with correct values for all 5 device configs |
| BUDGET-02 | Prompt-level `maxEffects` guidance matches DeviceCapabilities -- no mismatch | Full audit of all 4 family prompt files + tone-intent-fields.ts + planner.ts stompRestriction |
| BUDGET-03 | Stadium block budget reflects actual DSP capacity -- at least 8 user effects | Stadium slot grid analysis (b01-b12 = 10 user slots) confirms capacity far exceeds current cap of 4 |
| BUDGET-04 | Helix LT/Floor prompt allows 8+ effects per DSP path | Helix has Infinity maxEffectsPerDsp but prompt/schema cap at 6; need to raise both |
| BUDGET-05 | Chain-rules effect truncation logs a warning when effects are dropped | Identified exact truncation site (chain-rules.ts:389-390); currently silent, needs console.warn |
</phase_requirements>

## Standard Stack

No new libraries needed. All changes are value corrections and log additions in existing files.

### Core Files to Modify

| File | Purpose | Change Type |
|------|---------|-------------|
| `src/lib/helix/device-family.ts` | DeviceCapabilities constants | Value corrections |
| `src/lib/helix/chain-rules.ts` | Signal chain effect truncation | Add warning log |
| `src/lib/helix/tone-intent.ts` | Zod schema `.max(6)` | Raise max |
| `src/lib/families/helix/prompt.ts` | Helix planner prompt maxEffects | Value correction |
| `src/lib/families/stadium/prompt.ts` | Stadium planner prompt maxEffects | Value correction + text |
| `src/lib/families/stomp/prompt.ts` | Stomp planner prompt maxEffects | Value correction |
| `src/lib/planner.ts` | Stomp variant restriction maxFx | Value correction |
| `src/lib/helix/config.ts` | STOMP_MAX_BLOCKS constants | Value corrections |

### Test Files to Update

| File | Purpose | Change Type |
|------|---------|-------------|
| `src/lib/helix/device-family.test.ts` | Device capability assertions | Update expected values |
| `src/lib/helix/chain-rules.test.ts` | Signal chain assembly tests | Update/add truncation tests |
| `src/lib/families/podgo/prompt.test.ts` | Pod Go prompt assertions | Verify still pass (no change to Pod Go) |

## Architecture Patterns

### Hardware Block Budget Calculation

The correct `maxEffectsPerDsp` for each device must account for:

```
maxEffectsPerDsp = totalBlockSlots - fixedBlocks
```

Where `fixedBlocks` = amp(1) + cab(1) = 2 minimum. Mandatory blocks (boost, gate, EQ, volume) are inserted by chain-rules AFTER the maxEffectsPerDsp truncation, so they should NOT be subtracted from the limit. The `maxEffectsPerDsp` represents the maximum number of USER-chosen effects that chain-rules will accept.

**CRITICAL INSIGHT:** Chain-rules truncation (line 389) happens BEFORE mandatory block insertion (lines 399-460). This means `maxEffectsPerDsp` should represent the number of user effects the device can hold ALONGSIDE the mandatory blocks, not the total block count minus mandatory blocks.

### Correct Values Table

| Device | Total Blocks | Amp+Cab | Mandatory Blocks | Current maxEffectsPerDsp | Correct maxEffectsPerDsp | Reasoning |
|--------|-------------|---------|-------------------|------------------------|-------------------------|-----------|
| **Helix Floor/LT/Rack** | 8 per DSP (16 total) | 1+1 on DSP0 | boost(1) + gate(0-1) on DSP0; EQ(1) + volume(1) on DSP1 | `Infinity` | `Infinity` | No change needed -- DSP block limit (8 per DSP) provides the natural cap |
| **HX Stomp** | 8 (FW 3.0+) | 1+1 | boost(1) = 3 fixed | `2` | `4` | 8 total - amp(1) - cab(1) - boost(1) - gate(0-1) = 4-5 user effects; use 4 as safe value |
| **HX Stomp XL** | 8 (same as Stomp) | 1+1 | boost(1) = 3 fixed | `5` | `4` | Same hardware as HX Stomp -- same 8 block limit, same DSP chip |
| **Pod Go** | 4 flexible | N/A (amp+cab separate) | none | `4` | `4` | No change needed -- hardware-enforced 4 flexible block limit |
| **Stadium** | 12 user slots (b01-b12) | 1+1 (b05-b06) | EQ(1) + volume(1) = 2 | `4` | `8` | 12 slots - amp(1) - cab(1) - mandatory EQ(1) - mandatory volume(1) = 8 user effects |

### STOMP_MAX_BLOCKS Correction

The codebase has:
- `STOMP_MAX_BLOCKS: 6` -- This was the pre-FW 3.0 limit. Since FW 3.0 (and the codebase targets FW 3.80), HX Stomp supports 8 blocks.
- `STOMP_XL_MAX_BLOCKS: 9` -- This is wrong. HX Stomp XL has always had the same 8-block limit as HX Stomp. They share the same DSP chip.

**Correct values:**
- `STOMP_MAX_BLOCKS: 8` (verified: FW 3.0+ release notes, HX Stomp XL FAQ, community sources)
- `STOMP_XL_MAX_BLOCKS: 8` (verified: same DSP chip, same block limit, XL FAQ)

**IMPORTANT CAVEAT:** The STOMP_MAX_BLOCKS values are used as `maxBlocksPerDsp` and `maxBlocksTotal` in device-family.ts. Changing these from 6/9 to 8/8 affects the block limit validation in chain-rules.ts (line 524-528) and validate.ts (line 158-159). The .hlx file format may define more block slots than the firmware allows -- this needs careful verification. However, real-world users confirm 8 blocks is the limit for both devices on FW 3.80.

### Prompt maxEffects Correction Table

| Family | File | Current maxEffects | Correct maxEffects | Reasoning |
|--------|------|-------------------|-------------------|-----------|
| Helix | `helix/prompt.ts:79` | 6 | 8 | Helix has 8 blocks per DSP; users routinely use 8+ effects across dual DSPs |
| Stadium | `stadium/prompt.ts:46` | 6 | 8 | Stadium has 10 user-effect slots; 8 after mandatory EQ+volume |
| Stomp | `stomp/prompt.ts:70` | 4 | 4 | Conservative unified value; device restriction in user message overrides |
| Pod Go | `podgo/prompt.ts:66` | 4 | 4 | Correct -- hardware limit |

### Planner.ts Stomp Restriction Correction

```typescript
// Current (planner.ts:64):
const maxFx = isXL ? 5 : 2;

// Correct:
const maxFx = isXL ? 4 : 4;  // Both share same DSP/block limit
```

Wait -- but if both Stomp and Stomp XL have 8 blocks and the same DSP, why different maxFx? The XL only differs in footswitch count and snapshot count. The maxFx should be the same for both: 4 user effects (leaving room for amp, cab, boost, and possibly gate).

### Zod Schema `.max(6)` Correction

```typescript
// Current (tone-intent.ts:42):
effects: z.array(effectSchema).max(6),

// Correct:
effects: z.array(effectSchema).max(10),
```

The Zod max should be high enough to accommodate any device family. The per-device limit is enforced by chain-rules truncation and prompt guidance, not the schema. Setting `.max(10)` allows Stadium (up to 8 user effects) and Helix (up to 8 per DSP, but across 2 DSPs) without schema rejection.

Note: `zodOutputFormat` in the Anthropic SDK strips `min`/`max` from JSON Schema for constrained decoding (planner.ts:123 comment), so the Zod `.max()` only affects the belt-and-suspenders parse validation. Raising it from 6 to 10 is safe.

### Stadium Prompt Text Corrections

The stadium prompt has multiple hardcoded "6 effects" references that need updating:

1. `stadium/prompt.ts:46`: `toneIntentFieldsSection({ maxEffects: 6, ... })` -> `maxEffects: 8`
2. `stadium/prompt.ts:57`: `"Keep effects to 4-6 maximum"` -> `"Keep effects to 4-8 maximum"`
3. `stadium/prompt.ts:91`: `"up to 6 effects"` -> `"up to 8 effects"`

### Helix Prompt Text Corrections

1. `helix/prompt.ts:79`: `toneIntentFieldsSection({ maxEffects: 6, ... })` -> `maxEffects: 8`
2. `helix/prompt.ts:90`: `"2-4 is typical, 6 is the maximum"` -> `"2-4 is typical, 8 is the maximum"`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Effect truncation logging | Custom logging framework | `console.warn()` | Vercel captures console.warn in function logs; consistent with existing console.warn usage in chain-rules.ts (line 283) |

## Common Pitfalls

### Pitfall 1: Changing STOMP_MAX_BLOCKS breaks .hlx file format tests
**What goes wrong:** The STOMP_MAX_BLOCKS value is used as `maxBlocksPerDsp` and `maxBlocksTotal` in DeviceCapabilities. These are used in chain-rules.ts block limit validation AND validate.ts block limit validation. If real .hlx files from the codebase were generated with the old block counts, changing the limits could cause existing test failures.
**Why it happens:** The .hlx file format may have a fixed number of block slots in the dsp0/dsp1 structure, independent of the firmware block limit.
**How to avoid:** Verify that the block limit validation in chain-rules.ts and validate.ts uses `maxBlocksTotal` (which should be 8 for both Stomp variants), and that no test fixtures depend on the old 6/9 values.
**Warning signs:** Test failures in preset-builder or validate tests after changing STOMP_MAX_BLOCKS.

### Pitfall 2: Stadium mandatory blocks miscounted
**What goes wrong:** Setting Stadium `maxEffectsPerDsp=10` (all user slots) without accounting for mandatory EQ + volume would allow chain-rules to accept 10 user effects, then add 2 mandatory blocks + amp + cab = 14 blocks, exceeding Stadium's capacity.
**Why it happens:** Mandatory blocks are inserted AFTER truncation. The truncation limit must leave room for them.
**How to avoid:** The correct Stadium `maxEffectsPerDsp=8` accounts for: 12 user slots - mandatory EQ(1) - mandatory volume(1) = 10, then subtract amp(1) + cab(1) = 8 user effects max. But wait -- amp and cab are ALSO in the b01-b12 range (at b05-b06), so they're already counted in the 12 slots. So: 12 total user block positions (b01-b12) - amp(1 at b05) - cab(1 at b06) - mandatory EQ(1) - mandatory volume(1) = 8 user effect slots.
**Warning signs:** Block limit exceeded errors when generating presets with 8 effects.

### Pitfall 3: Zod max too low blocks valid presets
**What goes wrong:** The Zod schema `.max(6)` will reject ToneIntents with 7-8 effects even if the prompt asks for them. This causes a Zod parse error in planner.ts:139.
**Why it happens:** The Zod schema is a global limit applied to all families, but `zodOutputFormat` strips max constraints from JSON Schema so Claude can generate more effects. However, the belt-and-suspenders Zod parse at line 139 will reject >6 effects.
**How to avoid:** Raise `.max(6)` to `.max(10)` to accommodate Stadium's 8-effect capacity with headroom.
**Warning signs:** Zod validation errors after changing prompt maxEffects without changing the schema.

### Pitfall 4: Chain-rules boost/gate not counted in user effects
**What goes wrong:** Chain-rules inserts a mandatory boost (Minotaur or Scream 808) and optionally a Horizon Gate AFTER the user effect truncation. If `maxEffectsPerDsp` is set too high for Stomp, the total blocks (user effects + mandatory boost + amp + cab) could exceed the 8-block hardware limit.
**Why it happens:** The boost is ALWAYS inserted (unless user already includes it), but it's not counted as a "user effect" for truncation purposes.
**How to avoid:** For Stomp, set `maxEffectsPerDsp=4` which leaves room for: amp(1) + cab(1) + boost(1) + user effects(4) = 7 blocks, with 1 block of headroom for a gate.
**Warning signs:** Block limit exceeded errors for high-gain Stomp presets (which add both boost AND gate).

### Pitfall 5: Stomp mandatoryBlockTypes is empty
**What goes wrong:** Stomp and Pod Go have `mandatoryBlockTypes: []`, meaning chain-rules does NOT insert EQ or volume blocks for these devices. However, chain-rules DOES always insert a boost (Minotaur/Scream 808) and optionally a Horizon Gate regardless of mandatoryBlockTypes. These "always inserted" blocks must be accounted for in the maxEffectsPerDsp budget.
**Why it happens:** mandatoryBlockTypes only controls EQ and volume block insertion. Boost and gate insertion is unconditional (lines 402-435).
**How to avoid:** The maxEffectsPerDsp calculation for Stomp must subtract boost(1) from total available slots: 8 - amp(1) - cab(1) - boost(1) = 4 for clean/crunch. For high_gain, also subtract gate: 8 - amp(1) - cab(1) - boost(1) - gate(1) = 3. Use 4 as the cap since gate is only for high_gain.

## Code Examples

### Chain-rules truncation with warning (BUDGET-05)

```typescript
// chain-rules.ts lines 387-391 — BEFORE (current):
if (caps.maxEffectsPerDsp < Infinity && userEffects.length > caps.maxEffectsPerDsp) {
    userEffects.length = caps.maxEffectsPerDsp;
}

// AFTER (with warning):
if (caps.maxEffectsPerDsp < Infinity && userEffects.length > caps.maxEffectsPerDsp) {
    const dropped = userEffects.length - caps.maxEffectsPerDsp;
    console.warn(
      `[chain-rules] Effect budget exceeded: ${userEffects.length} effects requested, ` +
      `max ${caps.maxEffectsPerDsp} for ${caps.family}. Dropping ${dropped} effect(s): ` +
      userEffects.slice(caps.maxEffectsPerDsp).map(e => e.model.name).join(', ')
    );
    userEffects.length = caps.maxEffectsPerDsp;
}
```

### DeviceCapabilities corrections

```typescript
// device-family.ts — Stadium:
maxEffectsPerDsp: 8,  // Was 4. Stadium has 12 user slots (b01-b12), minus amp+cab+EQ+volume = 8

// device-family.ts — Stomp:
maxEffectsPerDsp: 4,  // Was 2. Stomp has 8 blocks (FW 3.0+), minus amp+cab+boost = 4-5

// device-family.ts — Stomp XL:
maxEffectsPerDsp: 4,  // Was 5. Same DSP/block limit as Stomp since they share hardware
```

### Config corrections

```typescript
// config.ts:
STOMP_MAX_BLOCKS: 8,     // Was 6. FW 3.0+ increased to 8 blocks
STOMP_XL_MAX_BLOCKS: 8,  // Was 9. Same as Stomp — same DSP chip, same limit
```

### Zod schema correction

```typescript
// tone-intent.ts:42:
effects: z.array(effectSchema).max(10),  // Was .max(6). Raised to accommodate Stadium 8 effects
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HX Stomp 6 blocks | HX Stomp 8 blocks | FW 3.0 (Nov 2020) | Config STOMP_MAX_BLOCKS must be 8 |
| Conservative effect limits | Match hardware | This phase | Presets use full DSP capacity |

## All Sites Requiring Changes

### 1. `src/lib/helix/config.ts`
- Line 69: `STOMP_MAX_BLOCKS: 6` -> `8`
- Line 71: `STOMP_XL_MAX_BLOCKS: 9` -> `8`

### 2. `src/lib/helix/device-family.ts`
- Line 137: `maxEffectsPerDsp: 2` (Stomp) -> `4`
- Line 156: `maxEffectsPerDsp: 5` (Stomp XL) -> `4`
- Line 197: `maxEffectsPerDsp: 4` (Stadium) -> `8`

### 3. `src/lib/helix/tone-intent.ts`
- Line 42: `.max(6)` -> `.max(10)`

### 4. `src/lib/helix/chain-rules.ts`
- Lines 387-391: Add `console.warn` before truncation (BUDGET-05)

### 5. `src/lib/families/helix/prompt.ts`
- Line 79: `maxEffects: 6` -> `maxEffects: 8`
- Line 90: `"6 is the maximum"` -> `"8 is the maximum"`

### 6. `src/lib/families/stadium/prompt.ts`
- Line 46: `maxEffects: 6` -> `maxEffects: 8`
- Line 57: `"4-6 maximum"` -> `"4-8 maximum"`
- Line 91: `"up to 6 effects"` -> `"up to 8 effects"`

### 7. `src/lib/planner.ts`
- Line 64: `const maxFx = isXL ? 5 : 2;` -> `const maxFx = 4;` (same for both variants)

### 8. `src/lib/families/stomp/prompt.ts`
- Line 70: `const maxEffects = 4;` -- Already correct as the unified conservative value
- Line 107: Update genre-based effect discipline text to reflect 8-block budget (currently says "6 block slots")

### 9. Test files
- `src/lib/helix/device-family.test.ts`: Update assertions for maxBlocksTotal (6->8 for Stomp, 9->8 for Stomp XL)
- `src/lib/helix/chain-rules.test.ts`: Add test for truncation warning; may need to update DSP limit test
- `src/lib/families/podgo/prompt.test.ts`: No changes needed (Pod Go values unchanged)

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| Raise Stadium maxEffectsPerDsp 4->8 | LOW | Stadium builder already supports 12 block slots. Raising the limit just stops premature truncation. |
| Raise Stomp maxEffectsPerDsp 2->4 | LOW | Still conservative. 4 user effects + amp + cab + boost = 7, well within 8-block limit. |
| Change Stomp XL maxEffectsPerDsp 5->4 | MEDIUM | Actually LOWERS the limit. Verify no existing tests rely on 5. This is correct because Stomp XL shares the same 8-block DSP limit as Stomp. |
| Change STOMP_MAX_BLOCKS 6->8 | MEDIUM | Affects maxBlocksTotal validation. Need to verify .hlx file format and existing test fixtures. |
| Change STOMP_XL_MAX_BLOCKS 9->8 | MEDIUM | Lowers block limit. Verify existing test fixtures and real preset generation. |
| Raise Zod .max(6)->.max(10) | LOW | Only affects belt-and-suspenders parse validation. zodOutputFormat already strips max from JSON Schema. |
| Change prompt maxEffects | LOW | Prompt text changes are low risk. AI will generate more effects, which chain-rules will now accept. |
| Add console.warn to truncation | LOW | Logging-only change. No behavior modification. |

## Downstream Impact Analysis

### What reads `maxEffectsPerDsp`?
Only `chain-rules.ts:389` -- the effect truncation guard. No other code references this value.

### What reads `maxBlocksPerDsp` / `maxBlocksTotal`?
1. `chain-rules.ts:524-549` -- Block limit validation (throws if exceeded)
2. `validate.ts:158-178` -- Preset spec validation (throws if exceeded)
3. `device-family.test.ts` -- Test assertions

### What reads `STOMP_MAX_BLOCKS` / `STOMP_XL_MAX_BLOCKS`?
1. `device-family.ts:126-127` -- Sets `maxBlocksPerDsp` and `maxBlocksTotal` for Stomp
2. `device-family.ts:145-146` -- Sets `maxBlocksPerDsp` and `maxBlocksTotal` for Stomp XL
3. `stomp/prompt.ts:72` -- Used in prompt text for block count
4. `stomp/prompt.ts:139` -- Used in chat system prompt

### What reads the Zod `.max(6)`?
1. `planner.ts:139` -- Belt-and-suspenders parse validation
2. Any future consumer of `getToneIntentSchema(family).parse()`

## Open Questions

1. **STOMP_MAX_BLOCKS from real .hlx files**
   - What we know: Config comments say "Source: Direct inspection of real .hlx files (2026-03-04)". The values 6 and 9 don't match FW 3.0+ hardware limits (both 8).
   - What's unclear: Are these the number of dsp block positions in the .hlx JSON structure (format-level), or the firmware's runtime limit? The .hlx format might define 6 or 9 block slots in the JSON even if firmware allows 8.
   - Recommendation: Verify by inspecting a real HX Stomp .hlx file generated on FW 3.80. If the JSON has 8 block keys (dsp0.block0-block7), use 8. If it has 6 or some other number, the code may need separate "format slots" vs "firmware limit" values. For this phase, focus on `maxEffectsPerDsp` which is unambiguously wrong, and flag STOMP_MAX_BLOCKS as a secondary concern.

2. **Stomp high-gain: boost + gate + 4 user effects = 8 blocks?**
   - What we know: High-gain presets get both Minotaur/Scream 808 AND Horizon Gate auto-inserted. With 4 user effects: amp(1) + cab(1) + boost(1) + gate(1) + user(4) = 8 blocks exactly.
   - What's unclear: Does this leave zero headroom? What if a user effect is itself a dynamics/gate type?
   - Recommendation: 8 blocks is the hard limit. The math works exactly. If the user already included a gate, chain-rules deduplicates it (line 474), so no overflow.

3. **Should Helix maxEffectsPerDsp remain Infinity?**
   - What we know: Helix has 8 blocks per DSP. With DSP0 holding amp + cab + boost + gate, that leaves 4-6 user effects on DSP0. DSP1 holds EQ + volume + user effects, leaving 6 user effects on DSP1.
   - What's unclear: Should Infinity be replaced with a specific number? Currently, the DSP block limit (8) provides the natural cap via validation at line 541-552.
   - Recommendation: Keep Infinity. The per-DSP block limit validation provides a better error message ("DSP0 block limit exceeded: 10 non-cab blocks (max 8)") than a truncation. Helix users expect to manage DSP budget themselves.

## Sources

### Primary (HIGH confidence)
- Line 6 Helix 3.0 Release Notes: HX Stomp block count increased from 6 to 8
- Line 6 HX Stomp XL FAQ: Same 8-block limit, same DSP chip as HX Stomp
- `stadium-builder.ts` STADIUM_SLOT_ALLOCATION: b01-b12 = 12 user block positions
- `chain-rules.ts` source code: Truncation at line 389, mandatory insertion at lines 399-460
- `device-family.ts` source code: Current maxEffectsPerDsp values
- Pod Go FAQ: 4 flexible user-assignable effects blocks, fixed amp/cab/wah/vol/EQ

### Secondary (MEDIUM confidence)
- Line 6 community forums: Users confirm 8 blocks on both HX Stomp and Stomp XL
- Guitar Center / Sweetwater product pages: "8 blocks per preset" for both Stomp variants
- Line 6 Helix Stadium specs: Up to 48 dynamic blocks across 4 stereo paths

### Tertiary (LOW confidence)
- Stadium DSP per-path allocation: Lane-based DSP distribution details are unclear; firmware may impose per-path limits below 48 total

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All changes are in existing files, no new dependencies
- Architecture: HIGH - Block budget math verified against stadium-builder.ts slot grid and FW 3.0 release notes
- Pitfalls: HIGH - All edge cases identified through code analysis (mandatory block insertion order, Zod max, etc.)
- STOMP_MAX_BLOCKS: MEDIUM - Hardware limit is 8 (verified), but .hlx file format slot count may differ from firmware limit

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- hardware specs don't change frequently)
