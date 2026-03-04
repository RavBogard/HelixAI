# Phase 31: Device ID Research + Helix Floor Regression Fix — Research

**Researched:** 2026-03-04
**Domain:** Line 6 Helix preset file format constants — device ID verification and regression repair
**Confidence:** HIGH (regression root cause fully traced); MEDIUM (Stadium ID — requires real .hsp file); HIGH (test fix mechanics)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIX-01 | Helix Floor device ID regression — current `2162692` causes -8309 on real Helix Floor hardware; `orchestration.test.ts:93` expects `2162691` | **FULLY RESOLVED** — regression traced to commit `68ad895`; correct value `2162691` confirmed from real Helix Floor `.hlx` export in Phase 23. Fix is a one-line constant change with source comment. |
| STAD-02 (partial) | Stadium device ID verification protocol — `DEVICE_IDS.helix_stadium` must be set from a real `.hsp` file inspection, never guessed | Research confirms the ID is UNKNOWN from public sources; plan must include a user checkpoint to provide a real `.hsp` file OR inspect the Helix Stadium Edit app. |

</phase_requirements>

---

## Summary

Phase 31 has two distinct sub-tasks with very different confidence levels. The Helix Floor regression fix is fully understood and requires minimal code change. The Helix Stadium device ID research is constrained by a lack of publicly available `.hsp` file format documentation.

**Helix Floor fix (HIGH confidence):** The regression is a single-line commit error. In commit `68ad895` ("docs: start milestone v2.0 Persistent Chat Platform"), `DEVICE_IDS.helix_floor` was reset from `2162691` (confirmed correct by Phase 23 hardware inspection) to `2162692` with an incorrect comment "Floor and LT share the same preset format and device ID." Phase 23's work proved this comment is false — Helix Floor and Helix LT have distinct device IDs. The fix is: restore `helix_floor: 2162691`, add a source comment citing Phase 23 hardware verification and commit `3ba0768`, and update `orchestration.test.ts:93` literal to match. This is a two-file, two-line fix.

**Helix Stadium device ID (MEDIUM/LOW confidence):** No public source — GitHub repositories, Line 6 community forums, or web-accessible documentation — contains the `data.device` integer for a Stadium `.hsp` file. The only reliable methods are: (a) the user provides a real `.hsp` file exported from the Helix Stadium app, or (b) the plan includes a task to download a free `.hsp` preset from fluidsolo.com and inspect its `data.device` field. Research did confirm the Helix Stadium Edit app is a free download from line6.com and that fluidsolo.com hosts downloadable `.hsp` presets for registered (free) users.

**What research confirmed about .hsp format (MEDIUM confidence):** Community file size reports (15–47 KB) and the precedent of `.hlx` and `.pgp` being plain JSON strongly suggest `.hsp` is also JSON, making text-editor inspection viable. However, this is not confirmed by opening a real file. The plan must treat this as an unverified assumption.

**Primary recommendation:** The plan has two waves: Wave 1 fixes the Floor regression immediately (no unknowns); Wave 2 researches the Stadium ID from a real `.hsp` file via a user-blocking checkpoint, then documents constants. Do not attempt to guess the Stadium ID.

---

## Standard Stack

### Core (No New Packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x (existing) | Constant correction in `types.ts` | Already in use; this is a 1-line change |
| Vitest | existing | Test assertion update | Already in use |

**No new npm packages** for Phase 31. This phase is purely a constant verification and correction task.

### Conditional (Phase 32 onwards)

| Library | Version | Purpose | When to Add |
|---------|---------|---------|-------------|
| `@msgpack/msgpack` | ^3.0.0 | Decode `.hsp` if binary msgpack | Only after `.hsp` file is confirmed as msgpack encoding (likely NOT needed — see below) |

**Installation:**
```bash
# No packages for Phase 31
# If .hsp is confirmed JSON (likely): still nothing needed for inspection
```

---

## Architecture Patterns

### The Regression: How and Why It Happened

```
commit 3ba0768 (Phase 23 fix):
  DEVICE_IDS.helix_floor = 2162691  ← CORRECT (confirmed from real Floor .hlx export)
    |
    v  (10 days later)
commit 68ad895 ("docs: start milestone v2.0"):
  DEVICE_IDS.helix_floor = 2162692  ← WRONG (reverted to LT value with false comment)

Current state (Phase 31 starting point):
  types.ts:      helix_floor: 2162692  ← WRONG
  test line 93:  .toBe(2162691)         ← CORRECT (test was not reverted)
  test result:   1 FAILING test
```

The regression was introduced in a milestone-kickoff documentation commit, not an intentional code change. The comment "Floor and LT share the same preset format and device ID" is factually incorrect — Phase 23 hardware verification proved they have distinct device IDs.

### Pattern: Device ID Verification + Source Comment

**What:** Every `DEVICE_IDS` constant must cite its source in a comment.

**Why:** Without source provenance, the value can be accidentally overwritten (as happened here). A comment citing the real file and the phase that verified it prevents future regressions.

**Pattern established in Phase 23 and confirmed correct:**

```typescript
// CORRECT — Pattern to restore and apply going forward
export const DEVICE_IDS: Record<DeviceTarget, number> = {
  helix_lt: 2162692,    // 0x210004 — confirmed from real Helix LT .hlx exports (Phase 1, FNDN-03)
  helix_floor: 2162691, // 0x210003 — confirmed from real Helix Floor .hlx export (Phase 23, commit 3ba0768)
  pod_go: 2162695,      // 0x210007 — confirmed from 18 real .pgp files (Phase 12)
  // helix_stadium: ???  // UNKNOWN — must be read from real .hsp file (Phase 31, STAD-02)
};
```

### Pattern: Dual Test Assertion for Device IDs

**What:** Each device ID test uses BOTH a constant reference AND a literal integer.

**Why:** Two-assertion pattern catches two different failure modes:
- `expect(hlx.data.device).toBe(DEVICE_IDS.helix_floor)` — catches if constant is removed or renamed
- `expect(hlx.data.device).toBe(2162691)` — catches if constant value is silently changed

**Current state of orchestration.test.ts line 87-94:**

```typescript
// CURRENT (orchestration.test.ts lines 87-94) — test description and literal are CORRECT
// The constant is WRONG (types.ts has 2162692 instead of 2162691)
it("buildHlxFile with device='helix_floor' produces .hlx with device=2162691", () => {
  const spec = buildPresetSpec(cleanIntent());
  validatePresetSpec(spec);
  const hlx = buildHlxFile(spec, "helix_floor");

  expect(hlx.data.device).toBe(DEVICE_IDS.helix_floor);  // fails: 2162692 !== 2162691
  expect(hlx.data.device).toBe(2162691);                  // fails: 2162692 !== 2162691
});
```

**After fix — what the test should look like (NO CHANGE to test):**

```typescript
// The test is already correct — only types.ts needs to change
// After fixing DEVICE_IDS.helix_floor = 2162691, both assertions pass
```

### Pattern: .hsp Device ID Inspection Protocol

When the user provides a `.hsp` file:

```bash
# Step 1: Check encoding (first bytes tell us the format)
xxd file.hsp | head -5
# 7b 22 = {"  → plain JSON  (most likely)
# 82/83/84 = msgpack fixmap  → binary msgpack
# 50 4b 03 04 = PK.. → ZIP

# Step 2: If JSON — open in text editor and find:
# { "version": N, "data": { "device": XXXXXXX, ...
# That XXXXXXX integer is DEVICE_IDS.helix_stadium

# Step 3: If msgpack — install @msgpack/msgpack, decode:
node -e "const {decode}=require('@msgpack/msgpack'); const fs=require('fs'); console.log(JSON.stringify(decode(fs.readFileSync('file.hsp')),null,2))" | head -30
# Look for "device" field
```

### Recommended Project Structure (Phase 31 scope only)

```
src/lib/helix/
├── types.ts    # MODIFIED: helix_floor: 2162692 → 2162691 (one-line fix)
│                           + source comment citing Phase 23 + commit 3ba0768
src/lib/helix/
├── orchestration.test.ts   # NO CHANGE — test is already correct
.planning/phases/31-device-id-research-floor-fix/
├── floor-device-id-confirmed.md   # Document confirming the regression source
├── stadium-device-id.md           # Document Stadium ID once found
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Floor device ID | Compute from hex pattern | Read from `floor-device-id.txt` (Phase 23 output) + commit `3ba0768` | The value `2162691` was confirmed by real hardware inspection in Phase 23 |
| Stadium device ID | Guess from `0x21000x` pattern | Inspect real `.hsp` file's `data.device` field | Pattern-guessing produced the current Floor regression |
| `.hsp` format detection | Write a binary parser | `xxd file.hsp \| head -5` then text editor if JSON | Plain inspection is sufficient; no tooling needed for JSON |
| Msgpack decoding | Write custom decoder | `@msgpack/msgpack ^3.0.0` decode() | Only needed if `.hsp` is confirmed binary msgpack |

**Key insight:** Every previous device ID error in this codebase was caused by assumption rather than hardware inspection. Phase 31 must not introduce a new assumed value for Stadium.

---

## Common Pitfalls

### Pitfall 1: The Floor ID Is Already Known — Do Not Re-Research It

**What goes wrong:** Developer treats the Floor ID as unknown and tries to re-obtain it from community sources, duplicating Phase 23 work.

**Why it happens:** The RESEARCH.md prompt says "confirm from a real Helix Floor `.hlx` export OR from Phase 23 research." Phase 23 research is sufficient — the confirmed value `2162691` is in `23-02-SUMMARY.md` with hardware provenance.

**How to avoid:** The Floor fix in Phase 31 is NOT a research task. The correct value is `2162691` from Phase 23 commit `3ba0768`. The only work is: update the constant, add source comment, run tests.

**Warning signs:** Planning a checkpoint asking the user to provide a Floor `.hlx` file — this is unnecessary for Phase 31.

### Pitfall 2: Changing the Test Instead of the Constant

**What goes wrong:** Developer sees the failing test expects `2162691` and changes the test to pass at `2162692`, which would encode the wrong device ID permanently.

**Why it happens:** Test shows `Expected 2162691, received 2162692` — it could look like the test has the wrong value.

**How to avoid:** The test at line 93 is correct. `2162691` was confirmed from real Helix Floor hardware. The constant `helix_floor: 2162692` is the regression. Change the constant, not the test.

**Warning signs:** Test description changed to "device=2162692"; literal assertion changed to `.toBe(2162692)`.

### Pitfall 3: Guessing Stadium Device ID

**What goes wrong:** Developer observes the hex pattern `0x210004` (LT), `0x210003` (Floor), `0x210007` (Pod Go) and guesses Stadium might be `0x210008` or `0x210010` or similar.

**Why it happens:** The pattern looks deducible.

**How to avoid:** The pattern gaps are not predictable. Pod Go (`0x210007`) is 3 above LT (`0x210004`), which is already non-sequential. Stadium is a fundamentally different hardware platform (64-bit, FPGA, different DSP chipset) and may use a completely different ID range. Never guess.

**Warning signs:** `DEVICE_IDS.helix_stadium` set without a comment citing real `.hsp` file inspection.

### Pitfall 4: Not Documenting the Regression Source in the Fix Commit

**What goes wrong:** Developer fixes the constant without explaining WHY it was wrong and WHY `2162691` is correct. Future developers can revert it again.

**How to avoid:** The source comment in `types.ts` and the commit message must reference Phase 23 hardware verification and the regression commit `68ad895`.

**Warning signs:** Comment says "probably correct" or no comment at all.

### Pitfall 5: Assuming .hsp Is JSON Without Verification

**What goes wrong:** Developer opens a suspected `.hsp` file from fluidsolo.com in a text editor. It appears to be JSON. Developer confirms `.hsp` is JSON without actually inspecting the `data.device` field for the Stadium ID.

**How to avoid:** Two separate steps: (1) confirm encoding is JSON by checking first bytes OR readable text content, AND (2) read `data.device` value specifically. Both are required. Confirming encoding does not confirm the device ID was found.

---

## Code Examples

### Fix for FIX-01 (types.ts — one-line change)

```typescript
// Source: Phase 23 research and commit 3ba0768 (fix(phase-23): correct Helix Floor device ID)
// Regression introduced by commit 68ad895 (docs: start milestone v2.0)
export const DEVICE_IDS: Record<DeviceTarget, number> = {
  helix_lt: 2162692,    // 0x210004 — confirmed from real Helix LT .hlx exports (Phase 1, FNDN-03)
  helix_floor: 2162691, // 0x210003 — confirmed from real Helix Floor .hlx export (Phase 23, commit 3ba0768); regression in commit 68ad895 reverted to 2162692 — now restored
  pod_go: 2162695,      // 0x210007 — confirmed from 18 real .pgp files (Phase 12)
} as const;
```

### Test Verification (orchestration.test.ts — NO CHANGE NEEDED)

```typescript
// Source: src/lib/helix/orchestration.test.ts lines 87-94
// This test is already correct. After fixing the constant, both assertions pass.
it("buildHlxFile with device='helix_floor' produces .hlx with device=2162691", () => {
  const spec = buildPresetSpec(cleanIntent());
  validatePresetSpec(spec);
  const hlx = buildHlxFile(spec, "helix_floor");

  expect(hlx.data.device).toBe(DEVICE_IDS.helix_floor); // passes after fix: 2162691 === 2162691
  expect(hlx.data.device).toBe(2162691);                 // passes after fix: 2162691 === 2162691
});
```

### Stadium Device ID Placeholder (types.ts — for Phase 31 research output only)

```typescript
// AFTER Phase 31 Stadium inspection task:
// Replace ??? with value read from data.device in real .hsp file
helix_stadium: ???, // Source: .hsp export from Helix Stadium Edit app, inspected YYYY-MM-DD
```

### .hsp Format Inspection (shell commands for user or plan executor)

```bash
# If the user provides a .hsp file at e.g. /tmp/test.hsp

# Step 1: Check file encoding (first bytes)
xxd /tmp/test.hsp | head -3
# Expected for JSON: 7b 22 = {"
# Expected for msgpack: starts with 80-8f (fixmap) or c0-df range

# Step 2: If JSON — extract device ID directly
python3 -c "import json; d=json.load(open('/tmp/test.hsp')); print('device:', d['data']['device'])"

# Step 3: Record ALL version constants for STAD-02 compliance
python3 -c "
import json
d = json.load(open('/tmp/test.hsp'))
print('version:', d.get('version'))
print('schema:', d.get('schema'))
print('device:', d['data']['device'])
print('device_version:', d['data'].get('device_version'))
print('application:', d['data']['meta'].get('application'))
print('appversion:', d['data']['meta'].get('appversion'))
print('build_sha:', d['data']['meta'].get('build_sha'))
"

# Also check top-level tone structure:
python3 -c "
import json
d = json.load(open('/tmp/test.hsp'))
print('tone keys:', list(d['data']['tone'].keys())[:15])
"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `helix_floor: 2162688` (unverified) | `helix_floor: 2162691` (confirmed) | Phase 23, commit `3ba0768` | Eliminated -8309 for Floor users |
| `helix_floor: 2162691` (correct) | `helix_floor: 2162692` (regressed) | Commit `68ad895` (v2.0 kickoff docs) | Re-introduced -8309 regression |
| No source comments on DEVICE_IDS | Source comments required | Phase 31 | Prevents future silent overwrites |

**Regression timeline (critical for commit message):**

```
2026-03-02  commit 3ba0768: Phase 23 fixes Floor ID: 2162688 → 2162691 (confirmed)
2026-03-03  commit 68ad895: v2.0 kickoff docs RESETS Floor ID: 2162691 → 2162692 (WRONG)
2026-03-04  Phase 31: Restore 2162691 + add source comment
```

---

## Open Questions

1. **What is the correct Helix Stadium `data.device` integer?**
   - What we know: No public source (GitHub, forums, web search) contains this value. It is not in any indexed page as of 2026-03-04.
   - What's unclear: The exact integer.
   - Recommendation: Plan must include a blocking checkpoint. The user either: (a) provides a real `.hsp` file, or (b) downloads a free `.hsp` from fluidsolo.com (free account required). After inspection the plan documents the value and Phase 32 consumes it.

2. **Is `.hsp` plain JSON or msgpack?**
   - What we know: Community file sizes (15-47 KB) are consistent with JSON. `.hlx` and `.pgp` are both plain JSON. The msgpack evidence is only for the internal model definition binary (`p35md-*.bin`), not the preset files. Strong inference: `.hsp` is JSON.
   - What's unclear: Not confirmed by opening a real file.
   - Recommendation: Assume JSON in the plan. The first bytes of `xxd` will confirm within 1 second. If msgpack, the plan branches to add `@msgpack/msgpack` — but this branch is LOW probability.

3. **Does `data.device_version` differ between Helix Floor and Helix LT in generated files?**
   - What we know: Current `config.ts` sets `HLX_APP_VERSION = 58720256` (v3.80) for all Helix devices. Phase 23 research concluded this is sufficient for HX Edit compatibility.
   - What's unclear: Whether Floor-specific `device_version` is needed.
   - Recommendation: Do not change `config.ts` in Phase 31. Phase 23's firmware version update (v3.80) is already applied and correct.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/lib/helix/orchestration.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | `DEVICE_IDS.helix_floor !== DEVICE_IDS.helix_lt` | unit | `npx vitest run src/lib/helix/orchestration.test.ts` | ✅ (line 87-94, currently failing) |
| FIX-01 | `buildHlxFile(spec, "helix_floor").data.device === 2162691` | unit | `npx vitest run src/lib/helix/orchestration.test.ts` | ✅ (same test) |
| STAD-02 | `DEVICE_IDS.helix_stadium === <value from real .hsp>` | unit | Add new test to orchestration.test.ts | ❌ Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/helix/orchestration.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (currently 107/108 passing — 1 failing due to regression)

### Wave 0 Gaps

- [ ] `src/lib/helix/orchestration.test.ts` — needs new test for `DEVICE_IDS.helix_stadium` once value is known (covers STAD-02). Cannot be written until Stadium device ID is confirmed.

*(Existing orchestration.test.ts covers FIX-01 — test is correct and will pass after constant is fixed.)*

---

## Sources

### Primary (HIGH confidence)

- **Direct codebase analysis** — `src/lib/helix/types.ts` current state: `helix_floor: 2162692` (regression confirmed)
- **`git diff 3ba0768..68ad895 -- src/lib/helix/types.ts`** — regression commit `68ad895` exactly identified; one-line revert from `2162691` to `2162692`
- **`.planning/phases/23-fix-incompatible-target-device-type-error-8309/23-02-SUMMARY.md`** — confirms `2162691` was applied in commit `3ba0768` after hardware inspection; all 108 tests passed
- **`npx vitest run` output (2026-03-04)** — confirms 1 failing test: `orchestration.test.ts:93` expects `2162691`, receives `2162692`
- **`src/lib/helix/orchestration.test.ts` lines 87-94** — test is already correct; no change needed to test file
- **Line 6 Helix Stadium Presets Manual** — confirms `.hsp` format, one-way conversion: https://manuals.line6.com/en/helix-stadium/live/presets

### Secondary (MEDIUM confidence)

- **Community file size reports (15-47 KB for .hsp)** — consistent with JSON encoding; sourced from Fluid Solo and community forums
- **ilikekillnerds.com reverse engineering article (Dec 2025)** — confirms model naming conventions (`Agoura_*`, `HX2_*`) and msgpack format for model definitions binary (not preset files): https://ilikekillnerds.com/2025/12/21/reverse-engineering-the-helix-stadium-xl-editor-protocol/
- **Fluid Solo Stadium support confirmation** — `.hsp` presets available for download (free account required): https://www.fluidsolo.com/patchexchange/home/

### Tertiary (LOW confidence)

- **Inference: `.hsp` is JSON** — based on `.hlx`/`.pgp` precedent and file size range. NOT confirmed by opening a real `.hsp` file. The plan must treat this as unverified.
- **Stadium device ID** — completely unknown from public sources as of 2026-03-04. No GitHub repository, forum post, or indexed page contains this value.

---

## Metadata

**Confidence breakdown:**
- Floor regression root cause: HIGH — exact commit identified (`68ad895`), exact line (`helix_floor: 2162692`), regression value confirmed (`2162691` → `2162692`)
- Floor correct value: HIGH — `2162691` confirmed from real Helix Floor hardware export in Phase 23, documented in commit `3ba0768` and `23-02-SUMMARY.md`
- Floor fix mechanics: HIGH — one-line constant change + source comment; test already correct
- Stadium device ID: LOW — not found in any public source; requires real `.hsp` file inspection
- `.hsp` encoding: MEDIUM — strong inference it is JSON based on precedent; not confirmed by opening file
- Test framework: HIGH — vitest config exists and confirmed functional

**Research date:** 2026-03-04
**Valid until:** 2026-09-04 (Floor ID is stable — device IDs do not change with firmware; Stadium ID valid once confirmed from hardware)

---

## Phase 31 Plan Recommendations for the Planner

The planner should structure Phase 31 as TWO waves:

### Wave 1: Fix Floor Regression (no unknowns — fully autonomous)

**Goal:** Fix the live regression. No user input needed.

**Tasks:**
1. Update `src/lib/helix/types.ts`: change `helix_floor: 2162692` → `helix_floor: 2162691` with source comment citing Phase 23 and commit `3ba0768`
2. Verify `orchestration.test.ts` needs no changes (test already expects `2162691`)
3. Run `npx vitest run` — confirm 108/108 pass
4. Verify `DEVICE_IDS.helix_floor !== DEVICE_IDS.helix_lt`

**Files touched:** `src/lib/helix/types.ts` only (1 line)

### Wave 2: Stadium Device ID Research (requires user action checkpoint)

**Goal:** Document the Stadium device ID for Phase 32 consumption.

**Tasks:**
1. **Checkpoint (blocking):** User provides a real `.hsp` file OR downloads one from fluidsolo.com (free account) — any preset works
2. Inspect `.hsp` first bytes to confirm encoding (JSON vs msgpack)
3. Extract `data.device` integer using Python/shell command (see Code Examples above)
4. Extract all version constants: `version`, `schema`, `device_version`, `meta.application`, `meta.appversion`, `meta.build_sha`
5. Document constants in a `stadium-device-id.md` file in the phase directory
6. Write a stub test in `orchestration.test.ts` for `DEVICE_IDS.helix_stadium` (will be GREEN once Phase 32 adds the constant)

**Output consumed by Phase 32:** The `stadium-device-id.md` file with confirmed integer constants.

**CRITICAL:** If the user cannot provide a `.hsp` file, document this as a blocker. Do NOT guess the Stadium device ID to unblock Phase 32.
