# Pitfalls Research

**Domain:** Adding Helix Stadium device support to existing multi-device Helix preset app (HelixAI v3.0)
**Researched:** 2026-03-04
**Confidence:** HIGH for device ID regression and file format discovery (codebase analysis + Phase 23 research + official Line 6 docs); HIGH for Stadium architecture differences (official Line 6 manuals + reverse engineering blog); MEDIUM for model catalog risks (official model list verified, internal naming convention confirmed from reverse engineering); MEDIUM for DSP limit specifics (official specs confirmed at hardware level, file format encoding unknown until real .hsp inspection)

> This document supersedes the v2.0 pitfalls document (auth/persistence). The focus here is the risks of adding Helix Stadium as a new device target to an app that already generates presets for Helix LT, Helix Floor, and Pod Go. Previous pitfalls documents covered auth hydration, Supabase RLS, and OAuth redirect issues — those remain valid and are not repeated here.

---

## Critical Pitfalls

These cause broken features, hardware import errors, silent wrong-device generation, or complete format failures.

---

### Pitfall 1: Assuming Stadium Uses .hlx Format — It Uses .hsp

**What goes wrong:**

The app currently generates `.hlx` files (for Helix LT/Floor) and `.pgp` files (for Pod Go). A developer adding Stadium support might assume Stadium uses `.hlx` with a new device ID, following the LT/Floor pattern. This is wrong. Helix Stadium uses a completely new `.hsp` preset format that is a one-way conversion: any preset exported from Stadium cannot be re-imported into Helix/HX.

The file format difference is not cosmetic. The `.hsp` format has a different file extension, a different schema, and Helix Stadium ships with a different editor application ("Helix Stadium" app, not "HX Edit"). Stadium CAN import `.hlx` files from existing devices (as a migration path), but files must originate from Helix/HX firmware v3.50 or newer. Stadium does NOT load `.hlx` files it exported itself.

**Why it happens:**

The existing codebase has two builder patterns — `preset-builder.ts` for `.hlx` and `podgo-builder.ts` for `.pgp`. A developer extending the pattern might reach for `preset-builder.ts` and add a new `DEVICE_IDS.helix_stadium` constant, expecting that to be sufficient. The rename from `.hlx` to `.hsp` and the schema changes are not discoverable from the existing codebase alone.

**How to avoid:**

Before writing any code, inspect a real `.hsp` file exported by the Helix Stadium app to determine the JSON schema. The internal structure is likely JSON (following the `.hlx` precedent), but field names, topology encoding, path numbering, and block type integers may differ. Build a new `stadium-builder.ts` analogous to `podgo-builder.ts` — do NOT extend `preset-builder.ts`.

Key investigation questions that must be answered from a real `.hsp` file:
1. Is the file plain JSON, MessagePack, or another encoding? (community reverse engineering suggests JSON-like but this must be confirmed by opening a `.hsp` in a text editor)
2. What is the `schema` field value? (`"L6Preset"` in `.hlx` — does Stadium use a different schema string?)
3. What is the `data.device` integer for Stadium?
4. Does Stadium use `dsp0`/`dsp1` keys or a different path naming convention (e.g., `path1a`, `path1b`, `path2a`, `path2b`)?
5. What are the `@type` integer values for block types in `.hsp`?
6. Does the `@model` field use `HD2_*` prefixes, `Agoura_*` prefixes, `HX2_*` prefixes, or a mixed convention?

**Warning signs:**

- "Stadium device" added to `DEVICE_IDS` constant pointing to `buildHlxFile()` — almost certainly wrong
- Download file named `.hlx` for a Stadium preset — format mismatch
- Stadium preset loads in HX Edit without error — should not be possible if format is correct
- No `stadium-builder.ts` file created — Stadium has a different enough architecture to need its own builder

**Phase to address:** Stadium file format discovery phase (first Stadium phase — must be completed before any builder code is written)

---

### Pitfall 2: Wrong Device ID Causes Immediate Hardware Rejection (-8309)

**What goes wrong:**

Every `.hlx` (and presumably `.hsp`) file contains a `data.device` integer field. HX Edit and Helix Stadium app read this field on import and reject the file with error `-8309: Incompatible target device type` if the integer does not match the connected hardware's own device ID. This is a hard rejection — not a warning. The preset will not load.

This project has a documented history of device ID errors:
- Helix Floor started at `2162688` (unverified, suspected wrong from Phase 23 research)
- The test in `orchestration.test.ts` was then updated to expect `2162691` (line 93)
- But `types.ts` currently has `helix_floor: 2162692` (same as LT) with a comment "Floor and LT share the same preset format and device ID"
- These two are now contradictory — the test expects `2162691` but the constant produces `2162692`

This means `helix_floor` already has a regression: tests fail because `DEVICE_IDS.helix_floor = 2162692` but `orchestration.test.ts` line 93 asserts `2162691`. Stadium will have a fresh device ID that is completely unknown until a real `.hsp` file is inspected.

**Why it happens:**

Device IDs are hardware-specific integers assigned by Line 6. They cannot be guessed or computed — they must be read from a real export from the target device. The Helix LT ID (`2162692`, hex `0x210004`) is confirmed working. The Floor ID has been changed multiple times by developers guessing at the correct value. Each guess that is wrong causes -8309 for the affected device's users.

**How to avoid:**

The only correct method is to obtain a real `.hsp` file exported by the Helix Stadium app and read `data.device` from the JSON. For Helix Floor, the same method applies — obtain a real `.hlx` file exported from a Helix Floor via HX Edit.

**Sources for obtaining real exports:**

1. Ask a Stadium user in the Line 6 community to export any preset from Stadium, share the `.hsp`, open in text editor, read `data.device`
2. Check community preset sharing sites (fluidsolo.com lists Stadium presets as `.hsp` files for download)
3. Check The Gear Forum's Helix Stadium Talk thread — users share `.hsp` presets
4. For Floor ID: download a preset explicitly tagged "Helix Floor" from CustomTone (line6.com/customtone), inspect `data.device`

**Anti-pattern to avoid absolutely:**

Do NOT increment/decrement the existing constant by ±1 or ±4 to guess the Stadium ID. The hex pattern `0x210004` (LT) → `0x210007` (Pod Go) has a gap of 3, which does not tell us where Stadium falls. Wrong guesses produce -8309 for all Stadium users who download presets.

**Warning signs:**

- `DEVICE_IDS.helix_stadium` set to any value without a comment citing a real `.hsp` file inspection
- Test assertion for Stadium device hardcoded to a literal integer with no source comment
- Stadium preset imports into HX Edit without error (Stadium presets should only load in the Helix Stadium app)

**Phase to address:** Device ID verification task (earliest Stadium phase — block all Stadium builder work until device ID is confirmed from real hardware)

---

### Pitfall 3: Helix Floor Device ID Regression is Already Active and Blocking Tests

**What goes wrong:**

The current codebase has a live regression that must be fixed before Stadium work begins:

```
types.ts:    DEVICE_IDS.helix_floor = 2162692  (same as LT)
test line 93: expect(hlx.data.device).toBe(2162691)  (expects different value)
```

This means `orchestration.test.ts` is currently failing or the test was updated to pass with the wrong constant. Either way, the Floor device ID is wrong — a user who generates a Floor preset gets `data.device = 2162692` (same as LT), which will reject on actual Floor hardware with -8309.

**Why it happens:**

From Phase 23 research: the constant was originally `2162688` (unverified), then a developer updated the test to expect `2162691` based on investigation, but did not update the constant. This left a broken pair: the code produces `2162692` but the test documents the value should be `2162691`. Adding Stadium to a broken codebase risks shipping the Stadium device ID wrong for the same reason.

**How to avoid:**

Fix the Floor device ID regression before adding Stadium. The process is:
1. Obtain a real Helix Floor `.hlx` export and read `data.device`
2. Update `DEVICE_IDS.helix_floor` in `types.ts` to the confirmed value
3. Update `orchestration.test.ts` line 93 literal to match (both `DEVICE_IDS.helix_floor` reference AND the hardcoded integer assertion)
4. Run tests — should pass

Do not update only `types.ts` without updating the test, or vice versa. Both must change together.

**Warning signs:**

- Test suite passes for `helix_lt` but the `helix_floor` test is skipped or commented out
- `DEVICE_IDS.helix_floor` equals `DEVICE_IDS.helix_lt` (both `2162692`) — this is the current broken state
- Test file `orchestration.test.ts` line 93 still says `2162691` after the constant is changed — tells you the test literal was never updated

**Phase to address:** Phase 1 of Stadium milestone (fix Floor regression first, before any Stadium code — prevents inheriting the broken pattern)

---

### Pitfall 4: Model Catalog Using Wrong Naming Convention for Stadium

**What goes wrong:**

The existing model catalog (`models.ts`) uses `HD2_*` prefixes for all model IDs (e.g., `HD2_AmpUSDeluxeNrm`, `HD2_DistMirrored`). Pod Go models use the same `HD2_*` prefix with `Mono`/`Stereo` suffixes. Helix Stadium introduces a new naming convention: Agoura amp models use `Agoura_*` prefix (e.g., `Agoura_AmpWhoWatt103`, `Agoura_AmpUSPrincess76`). Legacy HX models in Stadium appear to use `HX2_*` prefix instead of `HD2_*` (e.g., `HX2_GateHorizonGateMono` instead of `HD2_GateHorizonGateMono`).

A developer building the Stadium model catalog who copies `HD2_` model IDs from the existing catalog — without verifying against real `.hsp` exports or the Stadium app's model definition file — will produce a catalog where every model ID is wrong. Generated presets will fail validation (`Invalid model ID`) or, worse, silently load a wrong model on hardware.

**Why it happens:**

Stadium is both backward compatible (HX/Legacy models still exist) and forward-incompatible (Agoura models have entirely new IDs). The naming convention change from `HD2_` to `HX2_` for legacy HX models in Stadium is a gotcha: the models are functionally the same but have different internal IDs in the Stadium platform. A developer who checks `HD2_GateHorizonGate` against "does Stadium have Horizon Gate?" would get "yes" but the ID `HD2_GateHorizonGate` is wrong for Stadium.

**How to avoid:**

Model IDs for Stadium must come exclusively from Stadium sources:
1. The Helix Stadium app ships with a binary model definition file at `[app path]/Contents/Resources/modeldefs/p35md-*.bin` (macOS). This is a msgpack stream containing all model names and their integer IDs.
2. Real `.hsp` file inspection — the `@model` field in blocks contains the actual ID string used by the format
3. The community reverse engineering blog (ilikekillnerds.com, December 2025) documents the msgpack model definition format

Do NOT port `HD2_*` IDs to a Stadium catalog without verifying each one against a real Stadium source. Assume all IDs are wrong until proven correct from Stadium hardware.

**Warning signs:**

- Stadium model catalog entries that are direct copies of `models.ts` entries with only the device filter changed
- No `Agoura_` prefixed entries in Stadium amp models
- Model IDs in Stadium catalog that start with `HD2_` for amp models (Stadium Agoura amps use `Agoura_` prefix)
- Stadium validate.ts whitelist includes `HD2_Amp*` IDs without verifying they are valid in Stadium

**Phase to address:** Stadium model catalog phase — requires dedicated research from real Stadium sources before catalog population

---

### Pitfall 5: DSP/Block Limit Assumptions Based on Helix LT Rules

**What goes wrong:**

The existing `chain-rules.ts` enforces Helix block limits as `MAX_BLOCKS_PER_DSP = 8` per DSP. This is correct for Helix LT/Floor (dual DSP, 8 non-cab blocks each). Pod Go has its own `POD_GO_MAX_USER_EFFECTS = 4` and `POD_GO_TOTAL_BLOCKS = 10` limits.

Helix Stadium has an entirely different architecture: **4 stereo paths** (Path 1A, 1B, 2A, 2B) with **12 blocks per path**, for a total of up to 48 block locations. If Stadium chain rules reuse the `MAX_BLOCKS_PER_DSP = 8` constant, two problems occur:
1. Stadium presets will be unnecessarily constrained to 8 blocks when 12 are available per path
2. If Stadium uses a different path numbering scheme (paths instead of DSPs), the `dsp0`/`dsp1` field names in `BlockSpec` may be wrong for Stadium blocks

Additionally, Stadium uses "Dynamic DSP" where Agoura models consume significantly more DSP than HX Legacy models. The block count limit (12 per path) is a maximum location count, not a guaranteed usable count. A preset with 12 Agoura amp blocks would hit DSP limits before hitting the block count limit.

**Why it happens:**

The developer sees that Helix already has a dual-DSP architecture with block limits enforced in `chain-rules.ts` and assumes Stadium is "more of the same." The 4-path architecture is a fundamental structural difference that is not visible from the existing codebase.

**How to avoid:**

Stadium chain rules must be built from scratch, not derived from Helix chain rules. Key constraints to establish from real Stadium testing:
1. Are block limits per-path (12/path) or per-DSP with DSPs having higher capacity?
2. What is the effective block limit for a mix of Agoura + HX Legacy models? (DSP budget will be exhausted before position count for Agoura-heavy presets)
3. Does the `.hsp` file use `dsp0`/`dsp1` keys or `path1a`/`path1b`/`path2a`/`path2b` keys?
4. Is the `@path` integer encoding the same as Helix (0=Path A, 1=Path B)?

For safety: generate Stadium presets with conservative block counts initially (e.g., 8 blocks per path maximum) until DSP limits are calibrated against real hardware testing. This is the same approach used for Pod Go v1.2 — start with documented limits, then increase if headroom is found.

**Warning signs:**

- Stadium chain rules file contains `MAX_BLOCKS_PER_DSP = 8` directly (copied from Helix rules)
- Stadium `BlockSpec` entries use `dsp: 0 | 1` field without verifying this is valid for Stadium path encoding
- No `STADIUM_MAX_BLOCKS_PER_PATH` constant defined specifically for Stadium
- Stadium chain rule tests using the same block limit assertions as Helix LT tests

**Phase to address:** Stadium chain rules phase — do not write chain rules without first establishing block/path architecture from `.hsp` inspection

---

### Pitfall 6: EQ Model Mismatch — Stadium Replaced Four HX EQ Types

**What goes wrong:**

Helix Stadium does not include four EQ types that exist in Helix LT/Floor: Simple EQ, Low and High Cut, Low/High Shelf, and Parametric 5-band. These are replaced by a new 7-band Parametric EQ. If a Stadium preset is generated with any of these four EQ model IDs, the Stadium app will either reject the import or silently substitute the EQ — but a direct-generation workflow (bypassing import) would produce a preset with invalid model IDs that fail on hardware.

The project's `mandatory blocks` pattern inserts a `PARAMETRIC_EQ = "Parametric EQ"` block into every Helix preset. This EQ block uses `HD2_EQ_ParametricMono` or similar. If Stadium uses a different model ID for its 7-band Parametric EQ, the mandatory EQ block insertion in Stadium chain rules will use the wrong model ID.

**Why it happens:**

The EQ replacement is documented in the official Stadium manual but is easy to miss when reading compatibility notes focused on presets being "nearly 100% backward compatible." The 100% compatibility claim refers to functional parity after auto-substitution during import, not identical model IDs.

**How to avoid:**

When building the Stadium model catalog's EQ section, verify the model ID for Stadium's 7-band Parametric EQ from a real `.hsp` file. Do not assume it is `HD2_EQ_Parametric` or any variant of the Helix EQ model IDs. The mandatory EQ block in Stadium chain rules must use this verified ID.

Additionally, the Stadium model catalog must not include the four deprecated EQ model IDs. If validation checks against the Stadium catalog, these would fail — which is correct behavior. But if validation incorrectly allows them through, they will fail on hardware.

**Warning signs:**

- Stadium mandatory EQ block uses `PARAMETRIC_EQ = "Parametric EQ"` name from the Helix catalog without verification
- Stadium catalog includes `HD2_EQ_Parametric`, `HD2_EQ_SimpleEQ`, `HD2_EQ_LowHighCut`, or `HD2_EQ_LowHighShelf` model IDs
- Stadium validation whitelist allows any of the four deprecated EQ model IDs

**Phase to address:** Stadium model catalog phase (EQ section specifically)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse `preset-builder.ts` for Stadium by adding an `if (stadium)` branch | No new file, faster to write | Creates a builder that handles three incompatible formats; growing conditionals; Stadium differences are extensive enough to warrant their own file | Never — build `stadium-builder.ts` like `podgo-builder.ts` |
| Copy HD2_ model IDs from Helix catalog to Stadium catalog | Fast catalog population | Every amp model ID is wrong (Stadium uses `Agoura_*`); presets silently load wrong models | Never — verify all IDs from real Stadium source |
| Extend `DeviceTarget` type to `"helix_stadium"` before file format is confirmed | Unblocks TypeScript work | Creates false confidence that Stadium is wired up when format is unknown | Acceptable as a placeholder ONLY if clearly marked TODO with a test that fails |
| Use `dsp: 0 \| 1` field from `BlockSpec` for Stadium path encoding | Reuses existing type | Stadium has 4 paths (1A, 1B, 2A, 2B); encoding 4 paths as 0/1 loses Path 1B and 2B | Never — if Stadium uses 4 paths, `BlockSpec` needs a Stadium-specific variant |
| Guess Helix Floor device ID as same as LT (2162692) | Passes TypeScript | -8309 error for all Floor users; already the active regression | Never — must read from real Floor .hlx export |
| Set `DEVICE_IDS.helix_stadium` to a placeholder value like `0` | Passes TypeScript | Silent wrong device ID in generated files; no error until hardware import fails | Acceptable only if accompanied by a test that asserts `0` is NOT a valid ID and must be replaced |

## Integration Gotchas

Common mistakes when connecting to the Line 6 hardware ecosystem.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stadium preset generation | Assuming Stadium app accepts `.hlx` files as input format | Stadium uses `.hsp` format; `.hlx` is only for legacy Helix/HX hardware |
| Stadium app on macOS | Assuming `HX Edit` opens Stadium presets | Stadium uses a separate "Helix Stadium" app for editing; HX Edit is for Helix/HX only |
| Stadium import from Helix | Thinking import is the same as generation | Import converts `.hlx` → `.hsp` (one-way); generating directly requires Stadium's native format |
| Device ID for Floor | Assuming LT and Floor share `2162692` | Phase 23 research confirms this assumption is wrong; Floor has a distinct ID confirmed to be something else |
| Cab engine | Assuming `HD2_Cab*` model IDs work in Stadium | Stadium's Hybrid cab engine is removed; cab IDs may differ |
| EQ mandatory block | Inserting `HD2_EQ_Parametric` as mandatory for Stadium | Stadium replaced this EQ; must verify Stadium's 7-band Parametric EQ model ID |
| Snapshot controller | Assuming `@controller: 19` (Helix snapshot controller) works for Stadium | Pod Go uses `4`; Stadium may use yet another value — must verify from real `.hsp` |
| Footswitch indices | Assuming `STOMP_FS_INDICES = [7, 8, 9, 10]` from `preset-builder.ts` | Helix Stadium XL has 12 footswitches with different FS index assignments; verify from real export |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Stadium model catalog sharing memory with Helix catalog | One large `getAllModels()` call returns LT + Floor + Stadium models mixed together | Keep Stadium models in a separate `STADIUM_*_MODELS` export; filter by device in `validate.ts` | At catalog build time — wrong IDs bleed across device validation |
| Planner prompt including Stadium-only Agoura models for Helix devices | Claude selects `Agoura_AmpWhoWatt103` for a Helix LT preset | Device-filtered model list in planner prompt must strictly partition by device | First time Claude sees the full mixed catalog |
| Permitting `HD2_*` and `Agoura_*` model IDs in same validate call | Validation passes for both — no clear device boundary | Device-specific validation: `validatePresetSpec(spec, "helix_stadium")` should only allow Stadium model IDs | Immediately — cross-device model IDs accepted silently |

## Security Mistakes

Domain-specific security issues for this project.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting user-supplied device type string directly as `DeviceTarget` without validation | `device: "helix_stadium"` could be sent before Stadium is shipped, generating broken files | TypeScript union type exhaustiveness check; API route validates `device` is one of the known supported values |
| Generating Stadium presets before device ID is confirmed | Users download files that error on import; trust damage | Feature-flag Stadium device type behind a server-side constant; do not add to UI until confirmed working |

## UX Pitfalls

Common user experience mistakes when adding a new device.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Adding "Helix Stadium" to device selector before preset generation is confirmed working | Users select Stadium, get a broken download, lose trust | Only add Stadium to UI picker after end-to-end hardware test confirms presets load |
| Offering Stadium download as `.hlx` extension | Users can't import — Stadium app shows "unsupported format" | Use `.hsp` extension for Stadium downloads |
| Offering Stadium download as `.hsp` when format is unverified | Same import failure, harder to debug | Confirm format before shipping the download |
| Same download button behavior for all devices | Stadium uses different app (Helix Stadium, not HX Edit); users don't know what to do with the file | Stadium download card should note "Import using Helix Stadium app (not HX Edit)" |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Stadium in device selector:** Verify `buildStadiumFile()` is called, not `buildHlxFile()` — both produce valid-looking JSON but wrong format
- [ ] **Stadium device ID:** Verify `DEVICE_IDS.helix_stadium` has a comment citing a real `.hsp` file inspection source, not a guess
- [ ] **Stadium model catalog:** Verify at least one amp entry starts with `Agoura_` prefix — confirms catalog was built from Stadium sources, not copied from Helix catalog
- [ ] **Helix Floor regression fix:** Verify `DEVICE_IDS.helix_floor` does NOT equal `DEVICE_IDS.helix_lt` (current broken state is both equal `2162692`)
- [ ] **Test consistency:** Verify `orchestration.test.ts` line 93 literal matches `DEVICE_IDS.helix_floor` constant (currently `2162691` in test vs `2162692` in constant — these must agree)
- [ ] **Stadium chain rules:** Verify `MAX_BLOCKS_PER_DSP` constant is NOT used in Stadium chain rules (Stadium uses per-path limits, not per-DSP)
- [ ] **Stadium validation:** Verify `validatePresetSpec(spec, "helix_stadium")` rejects `HD2_Amp*` model IDs (if Stadium uses `Agoura_*` and `HX2_*`, the old `HD2_` IDs must not pass)
- [ ] **Snapshot controller:** Verify Stadium snapshots use the correct `@controller` integer (Helix uses `19`, Pod Go uses `4`, Stadium may differ)
- [ ] **Deprecated EQ models:** Verify Stadium model catalog does not contain `Simple EQ`, `Low/High Cut`, `Low/High Shelf`, or `Parametric 5-band` model IDs

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stadium format wrong (used .hlx structure) | HIGH | Inspect real .hsp file; rebuild stadium-builder.ts from scratch; re-test all Stadium presets |
| Stadium device ID wrong (-8309 on hardware) | LOW | Read data.device from real .hsp export; update DEVICE_IDS.helix_stadium; update test assertion; redeploy |
| Floor device ID still wrong after v3.0 ships | LOW (code) / HIGH (user trust) | Read data.device from real Floor .hlx export; hotfix DEVICE_IDS.helix_floor; update test; redeploy |
| Stadium model catalog with wrong HD2_ IDs | HIGH | All generated presets load wrong models; must rebuild catalog from Stadium source; retest all model paths |
| Stadium block limits too tight (8 vs 12) | MEDIUM | Update chain-rules constant; regenerate test fixtures; no user-facing breakage for existing presets |
| Stadium EQ mandatory block uses deprecated model | MEDIUM | Identify correct Stadium 7-band Parametric EQ model ID; update chain-rules mandatory insertion; re-verify |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stadium assumes .hlx format | Phase 1: Stadium file format research — inspect real .hsp before writing any builder code | `stadium-builder.ts` file exists; uses `.hsp` extension; NOT importing from `preset-builder.ts` |
| Stadium device ID unknown/wrong | Phase 1: File format research — `data.device` must be read from real .hsp | `DEVICE_IDS.helix_stadium` comment cites real file inspection; test assertion uses same value |
| Floor device ID regression | Phase 1 fix: Floor ID correction before Stadium work | `DEVICE_IDS.helix_floor !== DEVICE_IDS.helix_lt`; `orchestration.test.ts` line 93 literal matches constant; tests pass |
| Model catalog HD2_ naming | Phase 2: Stadium model catalog — built from Agoura_ sources | At least one amp model has `Agoura_` prefix; validation rejects `HD2_Amp*` for Stadium |
| DSP/block limits wrong | Phase 3: Stadium chain rules — use per-path limits from real hardware | `STADIUM_MAX_BLOCKS_PER_PATH` constant defined; value is 12 (or confirmed actual); Helix `MAX_BLOCKS_PER_DSP = 8` not used for Stadium |
| EQ deprecated models | Phase 2: Stadium model catalog (EQ section) | Stadium catalog missing `Simple EQ`, `Low/High Cut`, `Low/High Shelf`; mandatory EQ uses verified ID |
| Snapshot controller wrong | Phase 1: File format research + Phase 4: Stadium builder | Stadium builder snapshot section uses verified `@controller` value, not assumed 19 or 4 |
| UI ships before hardware verified | Final phase: Stadium device selector + download | Device selector only shows Stadium after end-to-end import test on real Stadium hardware is confirmed |

## The Device ID Verification Protocol

The Helix Floor regression happened because device IDs were assumed, not verified from hardware. This protocol must be followed for every new device:

### Step 1: Obtain Real Hardware Export
Export any preset from the target device using its official editor application.
- Helix LT/Floor: HX Edit → Export Preset → .hlx file
- Pod Go: POD Go Edit → Export Preset → .pgp file
- Helix Stadium: Helix Stadium app → Export Preset → .hsp file

### Step 2: Read data.device
Open the exported file in a text editor (all known Line 6 formats are JSON-based). Find `"device": [integer]` in the `data` section. This integer is the authoritative device ID.

### Step 3: Verify Against Expected Value
Cross-reference with any existing constant in `types.ts`. If they differ, the constant is wrong. If no constant exists yet, the read integer IS the value to use.

### Step 4: Document Source in Code
```typescript
// CORRECT — cite source
helix_stadium: 2162XXX, // Source: .hsp export from Helix Stadium v1.2 on 2026-03-XX

// WRONG — never do this
helix_stadium: 2162698, // guessed based on pattern
helix_stadium: 2162692, // assumed same as LT
```

### Step 5: Update Test With Same Literal
The test assertion must use BOTH the constant reference AND the same numeric literal:
```typescript
expect(hlx.data.device).toBe(DEVICE_IDS.helix_stadium);         // catches constant removal
expect(hlx.data.device).toBe(2162XXX); // catches silent constant value change
```

If these two assertions ever disagree, a regression has been introduced.

## Sources

### HIGH Confidence (direct codebase analysis)
- `src/lib/helix/types.ts` — DEVICE_IDS current values (`helix_floor: 2162692`, `helix_lt: 2162692`, `pod_go: 2162695`)
- `src/lib/helix/orchestration.test.ts` — Line 87-94: test asserts `helix_floor` should produce `2162691`, contradicting the constant
- `src/lib/helix/chain-rules.ts` — `MAX_BLOCKS_PER_DSP = 8`, Pod Go path exceptions, showing how device-specific rules are structured
- `src/lib/helix/podgo-builder.ts` — Pattern for device-specific builder (Stadium should follow this pattern)
- `.planning/phases/23-fix-incompatible-target-device-type-error-8309/23-RESEARCH.md` — Documented history of Floor device ID bug, correction methodology

### HIGH Confidence (official Line 6 documentation)
- Line 6 Stadium Manual (manuals.line6.com/en/helix-stadium/live/presets) — Confirms `.hsp` format, one-way conversion, 48 block locations
- Line 6 Stadium Manual (manuals.line6.com/en/helix-stadium/live/signal-path-routing) — 4-path architecture (1A, 1B, 2A, 2B), 12 blocks per path
- Line 6 announcement (line6.com/support/announcement/118) — `.hlx` → `.hsp` one-way, legacy Hybrid cab removal, deprecated EQ models
- Line 6 Helix Stadium Models (line6.com/helix-stadium-models/) — Confirms Agoura model names for Stadium

### MEDIUM Confidence (community reverse engineering, single source)
- ilikekillnerds.com (December 2025) — Reverse engineering Helix Stadium XL editor protocol; confirms `Agoura_*` and `HX2_*` model ID naming conventions; msgpack model definition file at `[app]/Contents/Resources/modeldefs/p35md-*.bin`
- The Gear Forum Helix Stadium Talk thread — Confirms `.hsp` files are shareable, 15-47 KB sizes (consistent with JSON)

### LOW Confidence (unverified, needs hardware confirmation)
- `.hsp` internal JSON structure: assumed JSON based on `.hlx` precedent and community forum file sizes (15-47 KB, consistent with JSON). NOT confirmed by opening a real `.hsp` in a text editor.
- Stadium `data.device` integer: completely unknown — no community source found with the actual integer value
- `@controller` integer for Stadium snapshots: unknown — Helix uses 19, Pod Go uses 4, Stadium value not found in any source

---
*Pitfalls research for: Helix Stadium device addition (v3.0)*
*Researched: 2026-03-04*
