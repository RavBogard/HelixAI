# Pitfalls Research

**Domain:** HelixTones v5.0 — Device-First Architecture Rework on a Live Production App
**Researched:** 2026-03-05
**Confidence:** HIGH — based on direct codebase inspection (chain-rules.ts, validate.ts, param-engine.ts, planner.ts, models.ts, tone-intent.ts, stadium-builder.ts, generate/route.ts, chat/route.ts, gemini.ts), v4.0 architecture audit (architecture-audit-v4.md), PROJECT.md bug history, STATE.md accumulated context, and official Anthropic prompt caching documentation.

> This document covers pitfalls specific to adding device-first architecture to a live production app. The prior v4.0 PITFALLS.md covered Stadium builder and param quality pitfalls. This document focuses on architectural migration risks, prompt caching hazards during prompt splitting, conversation migration, new device variant integration, and firmware parameter extraction.

---

## Critical Pitfalls

### Pitfall 1: Splitting the Planner Prompt Destroys the Cache for All Existing Users

**What goes wrong:**
The current `buildPlannerPrompt()` in `planner.ts` produces a single system prompt with a stable shared prefix (~80% of text) that is identical across all 6 devices. The `cache_control: { type: "ephemeral", ttl: "1h" }` annotation on this block builds one warm cache bucket that all device calls share. Splitting into device-specific prompts — even if each new prompt has an identical opening section — creates N separate cache buckets (one per device). Each new bucket starts cold and must pay `cache_creation_input_tokens` cost until warmed by enough requests.

The real danger: Stadium and Pod Go have far fewer daily users than Helix LT. Their cache buckets may never warm because request volume is too low to justify cache creation cost. The net effect is a cost increase for low-volume devices, not the cost decrease the split intends.

Worse: the v4.0 `cabAffinitySection` is dynamically built from `AMP_MODELS` at prompt construction time (planner.ts lines 41-67). This section is already device-conditionally filtered but appended inside the shared prefix. Any device-specific prompt that includes a static copy of this section will drift from the live model catalog the moment a new amp is added with `cabAffinity` — a maintenance trap invisible to TypeScript.

**Why it happens:**
Device-specific prompts feel like a clean win because the planner currently has conditional text bolted on at the end. Developers assume separate prompts means separate caches are acceptable. The interaction between cache TTL, per-device request volume, and cache creation cost is not modeled before splitting.

**How to avoid:**
Model the cache economics before splitting. Current cache hit rate is logged via `usage-logger.ts`. For each device, estimate daily generation requests. A cache bucket with fewer than 5-10 requests per TTL window will never recoup its `cache_creation_input_tokens` cost. If low-volume devices (Stadium, Pod Go) cannot sustain cache hits, keep a shared prompt prefix and put device differentiation in the user message, not the system prompt. Alternatively, group devices into families that share a cache bucket: Helix family (LT/Floor) share one prompt, Stomp family (Stomp/StompXL) share another, Stadium and Pod Go stay in separate buckets only if volume justifies it.

Do not regenerate `cabAffinitySection` dynamically inside device-specific prompts — centralize it as a module-level constant computed once at import time, then reused across all device prompt builders.

**Warning signs:**
- `cache_read_input_tokens` drops to zero or near-zero in the Vercel function logs after the prompt split
- `cache_creation_input_tokens` spikes in usage logs for every generation call during the first hour after deploy
- Cost per generation increases by more than 50% post-deploy (full input cost instead of cached cost)

**Phase to address:**
Device-specific prompt phase — model cache economics per device before splitting. Implement split only for devices with sufficient request volume to sustain warm cache buckets.

---

### Pitfall 2: The Combined AMP_NAMES Zod Enum is the Root of Cross-Device Contamination — Splitting It Requires Migrating the ToneIntentSchema

**What goes wrong:**
`AMP_NAMES` in `models.ts` (line 1340) is `[...Object.keys(AMP_MODELS), ...Object.keys(STADIUM_AMPS)]` — a combined tuple used in `ToneIntentSchema` as `z.enum(AMP_NAMES)`. The `zodOutputFormat` wraps this schema for Claude's constrained decoding. When device-specific prompts are implemented, the generation pipeline still uses the same combined `ToneIntentSchema` for all devices. Claude sees a Stadium-only amp list in its prompt but the constrained decoding allows HD2 amp names because the schema has not been split.

This means: even with device-specific prompts, a Stadium session can still generate a ToneIntent with `ampName: "Brit Plexi Jump"` because the Zod schema allows it. The prompt-level filtering and the schema-level validation are decoupled, and Zod's `z.enum()` cannot be conditionally narrowed at runtime without creating a separate schema per device. The current fallback logic in `chain-rules.ts` (the cross-catalog name-match heuristic) exists precisely because this schema gap was never closed.

**Why it happens:**
Adding a new device was always additive — STADIUM_AMPS was appended to AMP_NAMES, and device-specific filtering was added to `getModelListForPrompt()`. The Zod schema was never narrowed per device because `zodOutputFormat` does not accept runtime-conditional schemas easily. The result is that prompt filtering is a best-effort hint to the LLM, not a hard constraint.

**How to avoid:**
Create per-device ToneIntent schemas: `StadiumToneIntentSchema` uses `z.enum([...Object.keys(STADIUM_AMPS)])` for `ampName`. `HelixToneIntentSchema` uses `z.enum([...Object.keys(AMP_MODELS)])`. `StompToneIntentSchema` and `PodGoToneIntentSchema` are subsets of Helix. Pass the device-appropriate schema to `zodOutputFormat` in `callClaudePlanner()` based on `deviceTarget`. This closes the schema gap at the constrained decoding level — the LLM cannot generate a cross-device amp name because the JSON Schema does not allow it.

This is a non-trivial refactor: `ToneIntentSchema` is imported in `planner.ts`, `tone-intent.ts`, and potentially test files. The refactor must keep backward compatibility for the non-device-specific fields (effects, snapshots, guitar type, etc.) and only split the amp/cab enums.

**Warning signs:**
- Stadium generation logs show Agoura fallback heuristic firing (`[chain-rules] Agoura→HD2 fallback` warning)
- Helix generation logs show `[chain-rules] Stadium fallback` warning (Agoura amp picked for non-Stadium device)
- Device-specific prompts are deployed but cross-device contamination bug persists

**Phase to address:**
ToneIntentSchema split phase — must happen alongside or immediately after device-specific prompts, not deferred. Prompt filtering without schema filtering is incomplete contamination prevention.

---

### Pitfall 3: Moving Device Selection to Conversation Start Breaks Resumed Conversations

**What goes wrong:**
Chat persistence stores the full conversation history in Supabase per user. Existing conversations were created under the late-selection model: the user chatted without a committed device, then selected a device at the [READY_TO_GENERATE] step. Resumed conversations (opened from the sidebar) load the stored messages without the device-first context — there is no `device` field stored per conversation in the database schema (confirmed: `conversations` table stores `preset_url` and `updated_at`, not `device`).

When v5.0 moves device selection to conversation start and stores `device` as a conversation property, old conversations resumed under the new UI will not have a stored device. If the app assumes device is always set from the conversation record, resumed old conversations will crash or silently default to `helix_lt`. Users who had Pod Go or Stadium conversations will regenerate with the wrong device.

**Why it happens:**
Database migrations for live production apps are often scoped to new conversations only. Adding a `device` column to the `conversations` table with a `DEFAULT NULL` allows existing rows to persist without a device value. But application code that reads `conversation.device` without null-checking will crash on old rows. The migration plan and the application code must handle null `device` together.

**How to avoid:**
Migrate the `conversations` table with `ALTER TABLE conversations ADD COLUMN device TEXT DEFAULT NULL`. Write a migration script to backfill device from the stored `preset_url` extension: `.hlx` → assume `helix_lt`, `.pgp` → `pod_go`, `.hsp` → `helix_stadium`. This is imperfect (LT and Floor share `.hlx`) but sets a reasonable default that covers the majority of existing conversations. All application code that reads `conversation.device` must handle `null` with a graceful fallback: show the device picker when device is null rather than defaulting silently to `helix_lt`.

**Warning signs:**
- Users report that resumed Stadium conversations generate Helix LT presets
- Console errors: `TypeError: Cannot read property 'device' of null` in conversation loading
- The device picker is shown to users on mid-flight sessions who already selected a device in the prior session

**Phase to address:**
Device-first conversation flow phase — database migration and null-handling for resumed conversations must be in scope, not deferred. Go live with the new flow only after the migration has been applied and tested with real legacy conversation data.

---

### Pitfall 4: Guard-Based Branching Converted Partially Leaves the Codebase in a Hybrid State

**What goes wrong:**
The architecture-audit-v4.md documents ~17 guard sites across `chain-rules.ts` (10), `param-engine.ts` (3), and `validate.ts` (4). If device-first refactoring converts some guard sites to device modules but leaves others as `isPodGo()` / `isStadium()` guards, the codebase ends up in a hybrid state: some device behavior is in device modules, some is in shared files behind guards. This is worse than either pure approach because:

1. Developers adding a new device must search both device modules AND guard sites — no single registration point
2. A device module that handles chain assembly but delegates to a guard in `param-engine.ts` has a hidden coupling that is invisible from the module's perspective
3. Test coverage becomes ambiguous — does a device module test cover param resolution, or does it trust that the guard in `param-engine.ts` will do the right thing?

The specific risk: if `assembleSignalChain()` is replaced by device-specific chain assemblers but `validatePresetSpec()` retains its guard-based device branching, validation and assembly are now in different abstraction layers. A new device variant (Stadium XL) added to the device module will silently pass validation with the wrong rules because `validate.ts` does not know about the new variant.

**Why it happens:**
Refactors are done incrementally. The first phase converts chain-rules; the second defers param-engine "for a future phase"; the third defers validate. Each deferral is individually reasonable, but the cumulative effect is a permanent hybrid.

**How to avoid:**
Define the target architecture before writing any code: which files are replaced by device modules, which are extended, which are deleted. Commit to completing the full conversion within v5.0 (or explicitly time-box which guard sites remain). If `validate.ts` is not converted in v5.0, document which guard sites it still contains and add a test that asserts new devices added to `DeviceTarget` union cause a compile error in `validate.ts` (enforced by `Record<DeviceTarget, ...>` pattern).

Do not ship the partial refactor as "done" — document the guard sites that remain explicitly in STATE.md.

**Warning signs:**
- `chain-rules.ts` has device modules but `validate.ts` still has `if (isStadium(device))` scattered throughout
- A new device (Stadium XL) added to the `DeviceTarget` union does not produce a compile error in `validate.ts`
- Two code paths exist for the same device behavior: the device module and a guard site that was not removed

**Phase to address:**
Architecture refactor phase — establish a clear end state and a checklist of all files/guard sites that must be converted before the phase is marked complete.

---

### Pitfall 5: Firmware Parameter Extraction From Real .hsp Files Produces Incomplete or Wrong Values

**What goes wrong:**
The v4.0 architecture audit confirmed Stadium presets include only 12 of 27 firmware params per amp block. The missing params — `AmpCabPeak2Fc`, `AmpCabPeak2G`, `AmpCabPeak2Q`, `AmpCabPeakFc`, `AmpCabPeakG`, `AmpCabPeakQ`, `AmpCabShelfF`, `AmpCabShelfG`, `AmpCabZFir`, `AmpCabZUpdate`, `Aggression`, `Bright`, `Contour`, `Depth`, `Fat`, `Hype` — are not emitted in generated presets. When a user loads a generated preset, the firmware fills the missing params from the device's internal state (the last-loaded preset's values for those params). The result: every generated Stadium preset inherits partial sonic character from whatever preset was loaded before it. This is the param bleed bug reported by JC Logan ("all 4 snapshots sound the same") and "presets sound like factory preset."

The extraction risk: reading param values from a single real .hsp file gives values for that specific amp with that specific tone goal. If `Aggression: 0.7` is extracted from a high-gain metal reference and treated as a default for all Agoura high-gain amps, it biases all generated high-gain Stadium presets toward that single reference's character. Extraction without per-param semantic understanding produces defaults that are technically complete but tonally arbitrary.

**Why it happens:**
Building from analogy (HD2 amp params → Agoura amp params) is faster than extraction. The 15 missing params appear in real .hsp files but were not included in the initial `STADIUM_AMPS` `defaultParams` because they have no HD2 equivalent to reason from. Developers documented the incomplete extraction ("12 of 27 params") but deferred completing it.

**How to avoid:**
Extract defaults from a corpus of at least 5 real .hsp files per amp model (not 1). For each param, compute the median across the corpus rather than using a single reference value. Cross-check against Line 6 Stadium documentation or HelixHelp wiki for param semantic descriptions before assigning defaults. Params with documented unit types (dB, Hz, boolean) must be validated against the spec — `Level` is dB (not normalized 0-1), `Jack` is an integer enum, `ZPrePost` likely controls pre/post position.

For params where no corpus guidance exists, use the firmware's default value (the value found in a freshly-initialized preset on hardware) rather than inventing a value. A firmware default causes no state bleed; an invented value causes a different kind of bleed.

**Warning signs:**
- Generated Stadium preset sounds different depending on which factory preset was loaded on the device before importing it
- Amp block in generated .hsp has 12 param keys; reference .hsp has 27 param keys (count mismatch visible in JSON diff)
- `Hype`, `Fat`, `Contour` absent from generated .hsp amp block
- Two different generated Stadium presets from the same amp model have identical AmpCab* param values (copy-paste from a single reference, not corpus extraction)

**Phase to address:**
Stadium firmware parameter completeness phase — must be completed before Stadium is considered production-ready. Param bleed is a critical quality failure, not a cosmetic one.

---

### Pitfall 6: New Device Variants (Stadium XL, Helix Rack, Pod Go XL) Assumed Compatible With Existing Family Builders

**What goes wrong:**
The milestone context identifies three new device variants not currently supported: Stadium XL, Helix Rack, Pod Go XL. The assumption that these share format, device IDs, and param schemas with their family members (Stadium, Helix Floor, Pod Go) is an unverified hypothesis. The v4.0 architecture audit documented a precedent: `stadium-builder.ts` was initially implemented by analogy to `preset-builder.ts`, producing 5 confirmed format bugs that were only discovered by comparing generated output against real .hsp files.

Specific risks per variant:
- **Stadium XL**: May have a different `device_id`, `device_version`, or extended block count vs. Stadium. Using `helix_stadium` device ID for Stadium XL presets will cause HX Edit to reject the import.
- **Helix Rack**: Has different physical I/O than Helix Floor (rack-mount, different routing defaults). The `HELIX_SYSTEM_MODELS` constants (INPUT, OUTPUT, SPLIT, JOIN) must be verified against real Helix Rack exports. If Rack uses different I/O model IDs, any preset built with Floor I/O model IDs will have routing errors on Rack hardware.
- **Pod Go XL**: May have a different block budget or effect ordering convention than Pod Go. The `POD_GO_MAX_USER_EFFECTS = 4` constant may be wrong for Pod Go XL. If Pod Go XL allows more user effects, using the same constant under-budgets every generated preset.

**Why it happens:**
Family-variant devices look identical from the firmware perspective in documentation. Developers add the new `DeviceTarget` union value, map it to the family builder, and ship. The correctness assumption ("same family = same format") is almost always wrong at the device ID level and frequently wrong at the block budget or I/O model level.

**How to avoid:**
For each new variant, obtain at least 2 real preset files exported from that specific hardware (or from HX Edit targeting that device) before writing any code. Extract: device ID, device version, I/O model IDs, block count per DSP, snapshot count. Do not start implementation until these values are known from real files. If real hardware is not available, mark the device as "research pending" in the UI and block generation for that variant.

**Warning signs:**
- A new variant added to `DEVICE_IDS` has a device ID copied from its family member (e.g., Stadium XL uses Stadium's `2490368`)
- The new variant is activated in the UI without a corresponding real preset corpus inspection
- `validate.ts` allows the new variant without device-specific block limit rules (falls through to the Helix else branch with 8-block DSP limit)

**Phase to address:**
New device variant research phase — must precede any implementation. Each variant gets its own corpus inspection before code is written. Do not add a variant to `DeviceTarget` union until its device ID and block budget are confirmed from real files.

---

### Pitfall 7: Device Picker at Conversation Start Creates Orphaned Conversations When User Changes Device Mid-Conversation

**What goes wrong:**
Under the current late-selection model, device is selected at generation time — the conversation has no committed device until the user clicks Generate. Under device-first, device is selected before the first chat message. If the user changes their mind mid-conversation ("actually, I'm using Stomp not LT"), one of three failure modes occurs:

1. **The app ignores the change**: The conversation continues with the original device. The user generates a preset for the wrong device. They download an LT preset for their Stomp and it fails to load.
2. **The app restarts the conversation**: The conversation history is discarded. The user loses the discussion they just had. Frustrating UX.
3. **The app changes device but keeps history**: The chat system prompt and planner prompt change but the stored conversation messages reference device-specific constraints from the previous device. The planner may hallucinate based on LT-specific context when now targeting Stomp.

This is not a hypothetical: users frequently switch devices. Power users have multiple Line 6 devices. A guitarist with both an LT and a Stomp will start with LT, realize they need a Stomp preset, and want to switch.

**Why it happens:**
Device-first architecture optimizes for single-device sessions. Multi-device users are a minority but a high-value segment (power users, professionals). Their workflow is not modeled during design.

**How to avoid:**
Allow device switching with a visible confirmation step: "Switching to HX Stomp will update your device context. Your conversation history will be preserved, but some constraints have changed (block budget is tighter). Continue?" Store the new device in the conversation record. Pass the current `deviceTarget` through all downstream calls — do not cache device at conversation creation time. In the chat system prompt, confirm the device change by appending a system note to the conversation: "[Device changed to HX Stomp. Block budget: 6 total blocks.]" This keeps the LLM's context current without discarding history.

**Warning signs:**
- The device picker is hidden or disabled after the first message (hard-coded to the initial selection)
- `conversations.device` is set once on conversation creation and has no update path
- The generate route uses `conversation.device` from the database rather than `req.body.device` from the frontend — stale device after mid-conversation switch

**Phase to address:**
Device-first conversation flow phase — model device switching in the UI spec before building the picker. Add a device update API endpoint alongside the conversation creation endpoint.

---

### Pitfall 8: The Chat System Prompt Does Not Distinguish Device Families at the Conversation Level

**What goes wrong:**
`gemini.ts` returns a single `getSystemPrompt()` used for all devices in the chat phase. The system prompt (lines 34-141) contains device constraint summaries for all 6 devices. Under device-first architecture, the chat AI should only discuss the user's specific device — Stadium users do not need to hear about Pod Go DSP limits, and Pod Go users do not need dual-amp explanations. But more importantly: with device-first, the system prompt must NOT list other devices as options. If the system prompt still says "Supported Devices: Helix LT, Helix Floor, HX Stomp..." and a user asks "can I use this preset on my Pod Go?" the AI may incorrectly say "yes" or give advice that applies to a different device's budget.

The current system prompt also says explicitly "Do NOT ask which device they use" (line 46) — correct for the current model where device is already selected in UI. Under device-first, this instruction remains correct but the reasoning changes: device is committed at conversation start, not mid-flow. The system prompt must reference the specific device as a first-class context, not just list all devices.

**Why it happens:**
The chat system prompt was designed for the current architecture where the device is a late-binding UI widget, not a conversation property. Moving device to the start of the flow invalidates the "list all devices" design of the system prompt but developers may not update it because the chat still "works" — it just gives less focused advice.

**How to avoid:**
Create device-specific system prompts for the chat phase (or parameterize `getSystemPrompt(device)` to inject the specific device's constraints). The chat prompt for an HX Stomp session should only describe Stomp constraints, not list all 6 devices. The prompt for a Helix LT session should emphasize dual-amp capability. This improves interview quality: the AI can make concrete recommendations ("since you're on Stomp, we'll skip the post-cab EQ to save blocks") instead of hedging across all devices.

Cache consideration: the Gemini chat system prompt does not use Claude prompt caching (it uses Gemini), so splitting the chat system prompt has no cache cost. It does create more prompt maintenance surface, but the quality gain justifies it.

**Warning signs:**
- The chat system prompt still lists all 6 devices after device-first is implemented
- A Stadium user asks "can I get a dual amp preset?" and the AI says "yes, dual amp is supported"
- The AI's tone recommendations reference Pod Go block limits during a Helix LT session

**Phase to address:**
Device-first chat prompt phase — update `getSystemPrompt(device)` to be device-specific in the same phase that moves device selection to conversation start.

---

### Pitfall 9: The `isHelix()` Guard Treats LT and Floor as Identical But Helix Rack Has Different Capabilities

**What goes wrong:**
`types.ts` defines `isHelix(device)` returning true for `helix_lt` and `helix_floor`. This function is the guard used throughout the codebase to apply "Helix family" behavior (dual DSP, 8 blocks per DSP, dual-amp support). If Helix Rack is added to the Helix family and `isHelix()` is extended to return true for `helix_rack`, all Rack presets will inherit LT/Floor behavior — including dual-amp, dual-DSP split/join topology, and block type assignments.

The risk: Helix Rack has different physical I/O (rack-mount XLR outputs, different routing defaults) and may use different system model IDs than Floor/LT. If `HELIX_SYSTEM_MODELS.FLOW1_INPUT` is a Floor/LT model ID, using it for Rack presets will cause routing errors. The `isHelix()` function treats LT and Floor as identical (confirmed correct per audit) — but this cannot be extended to Rack without verification that Rack uses the same I/O model IDs and block format.

**Why it happens:**
`isHelix()` was designed as a family predicate, not a capability predicate. "Is this device in the Helix family?" and "does this device use Floor/LT I/O model IDs?" are different questions that currently resolve to the same answer. Adding Rack to the family assumes both questions have the same answer for Rack, which is unverified.

**How to avoid:**
Before adding `helix_rack` to `DeviceTarget`, extract the I/O model IDs from at least 2 real Helix Rack preset exports. Compare against `HELIX_SYSTEM_MODELS`. If they differ, add `HELIX_RACK_SYSTEM_MODELS` as a separate config object. The `isHelix()` predicate can remain a family predicate; the preset builder must do a sub-check: `isHelix(device) && !isHelixRack(device)` for the Floor/LT I/O path, `isHelixRack(device)` for the Rack I/O path.

**Warning signs:**
- `helix_rack` added to `isHelix()` return condition without a separate `HELIX_RACK_SYSTEM_MODELS` config verification
- Helix Rack presets built with `HELIX_SYSTEM_MODELS.FLOW1_INPUT` model ID that does not match real Rack exports
- The `DEVICE_IDS` record gets a `helix_rack` entry with a device ID copied from `helix_floor`

**Phase to address:**
Helix Rack device addition phase — corpus inspection first, implementation second. Block Rack generation until device ID and I/O model IDs are confirmed.

---

### Pitfall 10: Shared Chain Rules Assume Single-Path for All Non-Helix Devices — Stadium XL May Support Dual Path

**What goes wrong:**
`chain-rules.ts` currently encodes: Helix LT/Floor = dual DSP + dual path; Pod Go = single DSP; Stadium = single path; Stomp = single DSP. This mapping is derived from the 6 currently-supported devices. If Stadium XL supports dual-path (reasonable for a larger device), the current `isStadium()` guard routing all Stadium presets to single-path will under-generate for Stadium XL. Every XL user gets a single-amp preset when dual-amp was available.

The inverse failure is more dangerous: if the code assumes Stadium XL supports dual-path but hardware only has single-path, generated presets will fail to load on Stadium XL hardware. There is no firmware error at generation time — the hardware is the only validator.

**Why it happens:**
Device capabilities are assumed from family membership rather than verified from device documentation or corpus inspection. "Stadium XL is a bigger Stadium" implies more capability, but Line 6 may have kept the same single-path constraint to simplify the architecture.

**How to avoid:**
Verify Stadium XL's DSP topology from the Line 6 Stadium XL spec or real hardware presets before adding it to `DeviceTarget`. Do not assume it inherits Stadium's single-path constraint. Do not assume it extends to dual-path. Get real data. If real presets are not available, contact Line 6 or check the HelixHelp community wiki.

**Warning signs:**
- Stadium XL added to `DeviceTarget` and routed to `isStadium()` without a separate stadium_xl capability check
- Stadium XL documentation review skipped ("it's the same as Stadium, just bigger")
- Generated Stadium XL preset has a different block layout than a real Stadium XL factory preset

**Phase to address:**
New device variant research phase — same phase as Pitfall 6. Topology verification is as critical as device ID verification.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Split prompts without modeling cache economics per device | Clean device-specific prompts | Low-volume devices (Stadium, Pod Go) never warm cache; cost increases | Never without per-device request volume analysis first |
| Keep combined `AMP_NAMES` enum after adding device-specific prompts | No ToneIntentSchema refactor needed | Cross-device amp contamination persists; fallback heuristics remain active | Never — prompt filtering without schema filtering is incomplete |
| Add `device` column to `conversations` table without null-handling in app code | Fast migration | Old conversations crash on resume when app reads `device` without null check | Never — null-handling must ship with migration |
| Convert chain-rules guard sites but leave validate.ts guards unchanged | Faster iteration | Hybrid state — new devices bypass validation guards; capability gaps invisible | Acceptable only if STATE.md documents remaining guard sites and they are scheduled for a subsequent phase |
| Add Stadium XL to `isStadium()` return condition without corpus inspection | No new code paths needed | Stadium XL gets wrong block budget, device ID, or I/O model IDs | Never — corpus inspection is mandatory before any new device ships |
| Dynamically rebuild `cabAffinitySection` inside device-specific prompts | Stays current with model catalog | Every prompt reconstruction re-computes the same static data; cache invalidation risk | Never — compute once at module init, reuse across all device prompts |
| Copy-paste a single reference .hsp file's AmpCab* param values for all amps | Fast extraction of missing params | All Stadium presets inherit one reference's EQ character regardless of amp | Never — median from corpus of 5+ files per amp, not single reference |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Anthropic prompt caching — device split | Assuming all device prompts share one cache bucket | Each unique system prompt string creates its own bucket; group devices into families that share a prompt if request volume per device is low |
| Supabase conversations table — device field | Adding `device DEFAULT NULL` column but not null-checking in app code | All code paths that read `conversation.device` must handle null — show device picker, not silent default to helix_lt |
| zodOutputFormat — per-device enum | Assuming `z.enum(AMP_NAMES)` constrains Claude to device-appropriate amps when the prompt filters | zodOutputFormat passes the full enum to constrained decoding; per-device filtering requires per-device schema |
| Stadium .hsp firmware params — extraction | Reading param values from a single reference .hsp and treating as universal defaults | Use median from 5+ files per amp; validate unit types (dB vs normalized, integer vs float) before encoding |
| Device picker — mid-conversation switch | Storing device once on conversation creation with no update path | Device must be updatable mid-conversation; generate route reads device from request body, not only from database record |
| New device variant — `isHelix()` extension | Adding `helix_rack` to `isHelix()` without verifying Rack I/O model IDs | Verify I/O model IDs from real exports first; add sub-check if Rack differs from Floor/LT |
| Gemini chat system prompt — device-specific | Using same `getSystemPrompt()` for all devices after device-first moves device selection to conversation start | Parameterize system prompt by device; Stadium chat prompt should not mention Pod Go constraints |
| Device ID for new variants | Copying device ID from family member | Every variant has a unique device ID; extract from real hardware exports or HX Edit device targeting |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Device-specific prompts fragment cache into N buckets | Cost per generation spikes for low-volume devices (Stadium, Pod Go) | Model request volume per device before splitting; keep family-shared prompts for devices with fewer than 10 daily generations | Immediately after deploy — Stadium/Pod Go users pay full token cost on every generation |
| `buildPlannerPrompt(device)` recomputes `cabAffinitySection` on every call | CPU spike at moderate concurrency; not a correctness issue | Compute `cabAffinitySection` once at module import time (or use module-level memoization keyed by device) | At 50+ concurrent generations |
| Per-device ToneIntentSchema with inline model arrays | Large Zod schema objects computed per-request | Compute schemas once at import time using device-family constants | At 20+ concurrent generations |
| Supabase migration applied without index on `device` column | Conversation list queries slow if filtering by device | Add `CREATE INDEX idx_conversations_device ON conversations(device)` in migration | When conversation count per user exceeds ~100 |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Device type derived from user-provided request body without validation | User passes `device: "helix_stadium_xl"` (invalid), crashes generation | Validate `deviceTarget` against the `DeviceTarget` union immediately in generate route — reject unknown device strings |
| `device` stored from user-provided string without sanitization | Stored invalid device string in conversations table contaminates future reads | Validate device string against the `DeviceTarget` union before writing to Supabase |
| New device variants unlocked in UI before backend validation rules are ready | Users generate presets for unsupported devices that fail silently | Feature flag per device in environment config — new variants are gated until corpus inspection and validation rules are confirmed |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Device picker shown after [READY_TO_GENERATE] is removed in favor of conversation-start picker — but picker is confusing for new users | New users do not know which device to pick before talking about tone | Show device picker first but provide "I'm not sure" option that defaults to Helix LT with an explanation; allow switching during conversation |
| Resumed conversations show device picker again (null device from old conversation) | Returning users must re-pick their device instead of resuming naturally | For old conversations with null device, infer from `preset_url` extension if available; show picker only if inference is ambiguous |
| Stadium presets unblocked in UI before firmware param completeness is resolved | Users download Stadium presets that exhibit param bleed; trust in app erodes | Stadium remains UI-blocked until AmpCab* and hidden params are complete in generated presets AND verified on hardware |
| Device-specific prompts make Stadium conversation more restrictive ("Stadium is preview") | Stadium users get a weaker interview experience | Remove preview language once Stadium param completeness is resolved; treat Stadium as first-class device in chat |

---

## "Looks Done But Isn't" Checklist

- [ ] **Prompt cache verified post-deploy**: `cache_read_input_tokens` is nonzero in production logs for all device paths, not just Helix LT. Stadium and Pod Go must sustain cache hits.
- [ ] **ToneIntentSchema split complete**: Stadium generation cannot produce an HD2 amp name (`z.enum` for Stadium only includes Agoura amps). Verified by attempting to generate a Stadium preset with an HD2 amp name in the test suite.
- [ ] **Resumed conversations handle null device**: Old conversations opened from sidebar show device picker rather than silently defaulting to `helix_lt`. Tested with a seeded legacy conversation (no device column value).
- [ ] **Stadium firmware params complete**: Every Agoura amp in `STADIUM_AMPS` has all 27 params including AmpCab*, Aggression, Bright, Contour, Depth, Fat, Hype. Verified by JSON diff of generated vs. real .hsp file.
- [ ] **New device variants have confirmed device IDs**: Stadium XL, Helix Rack, Pod Go XL each have device IDs extracted from real exports — not copied from family member device IDs.
- [ ] **Guard site inventory closed**: After refactor, every guard site that was converted to a device module is removed from the shared files. Remaining guard sites are documented in STATE.md.
- [ ] **Device switch mid-conversation works**: User can change device selection after the first chat message; the new device is stored and used for generation without conversation restart.
- [ ] **Chat system prompt is device-specific**: Stadium chat session does not receive Pod Go or LT constraint descriptions. HX Stomp session does not receive dual-amp prompting.
- [ ] **Database migration applied and backfilled**: `conversations.device` column exists, old rows have inferred device from preset_url, app code null-checks the field.
- [ ] **6-device regression test after any shared file change**: Any change to `chain-rules.ts`, `param-engine.ts`, or `validate.ts` is tested against all 6 current device targets before merge.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Prompt split breaks cache for Stadium/Pod Go | LOW | Merge Stadium and Pod Go into a shared "constrained-device" prompt bucket; verify cache warms within one TTL window |
| AMP_NAMES split causes ToneIntentSchema regression | MEDIUM | Revert to combined schema; add schema split as a separate focused PR with dedicated test coverage for per-device enum validation |
| Resumed conversations crash on null device | LOW | Add null check in conversation loading code; deploy hotfix before broader v5.0 rollout |
| Stadium firmware param bleed persists after "completeness" phase | HIGH | Re-extract all 27 params from 5+ real .hsp files; cross-validate across corpus; re-run hardware import test |
| New device variant ships with wrong device ID | MEDIUM | Correct device ID in `DEVICE_IDS`, redeploy; existing generated presets in Supabase storage are already committed — users with old presets must regenerate |
| Hybrid guard/module state causes device capability gap | HIGH | Complete the guard conversion for the missed files; add TypeScript `Record<DeviceTarget, ...>` enforcement to catch gaps at compile time |
| Mid-conversation device switch not handled | LOW | Update generate route to accept device from request body (not only from database); update UI to allow device change with confirmation |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Prompt split destroys cache | Device-specific prompt phase — model cache economics first | `cache_read_input_tokens` nonzero in production logs for all device paths post-deploy |
| Combined AMP_NAMES allows cross-device contamination | ToneIntentSchema split phase — same phase as device-specific prompts | Test: Stadium generation rejects HD2 amp name at schema validation level |
| Resumed conversations break on null device | Device-first conversation flow phase — database migration in scope | Legacy conversation resumed from sidebar shows device picker, not wrong device default |
| Hybrid guard/module state | Architecture refactor phase — define end state before writing code | Guard site inventory in STATE.md shows zero remaining unplanned guard sites |
| Stadium firmware param incompleteness | Stadium firmware parameter completeness phase | JSON diff of generated vs. real .hsp shows 27 params for every amp block |
| New device variants assumed compatible | New device variant research phase — corpus before code | Each new variant has confirmed device ID from real exports; no family-member device ID reuse |
| Device picker creates orphaned conversations on switch | Device-first conversation flow phase — model device switching in UX spec | Device change mid-conversation is tested: stored device updates, generation uses new device |
| Chat system prompt is device-agnostic | Device-first chat prompt phase | Stadium chat session tested: AI does not mention Pod Go or dual-amp (LT-only) constraints |
| isHelix() extended to Rack without verification | Helix Rack device addition phase | Helix Rack I/O model IDs verified from real exports; separate config object if they differ |
| Stadium XL topology assumed without verification | New device variant research phase | Stadium XL block topology confirmed from Line 6 spec or real exports before code touches chain-rules |

---

## Sources

### HIGH confidence (direct codebase inspection)
- `src/lib/helix/chain-rules.ts` — guard pattern at ~17 sites, device-conditional branching, block budget enforcement (2026-03-05)
- `src/lib/helix/validate.ts` — 4 device-conditional branches, guard variables, model ID whitelist (2026-03-05)
- `src/lib/helix/param-engine.ts` — Stadium AMPS fallback, 3 guard sites, resolveAmpParams() layer structure (2026-03-05)
- `src/lib/planner.ts` — buildPlannerPrompt(), cache_control: ephemeral annotation, cabAffinitySection dynamic generation (2026-03-05)
- `src/lib/helix/models.ts` — AMP_NAMES combined tuple, getModelListForPrompt() filtering, STADIUM_AMPS catalog (2026-03-05)
- `src/lib/helix/tone-intent.ts` — ToneIntentSchema with combined AMP_NAMES enum, zodOutputFormat usage (2026-03-05)
- `src/lib/helix/types.ts` — DeviceTarget union, isHelix()/isStadium()/isPodGo()/isStomp() predicates (2026-03-05)
- `src/lib/gemini.ts` — getSystemPrompt() single-device-agnostic chat prompt, device list at lines 38-43 (2026-03-05)
- `src/app/api/generate/route.ts` — device resolution from request body, if-chain builder selection (2026-03-05)
- `.planning/architecture-audit-v4.md` — 17 guard sites documented, fragility analysis, refactor decision (2026-03-05)
- `.planning/PROJECT.md` — Stadium param bleed bug (JC Logan), Agoura amp leak, v5.0 scope (2026-03-05)
- `.planning/STATE.md` — accumulated decisions, Stadium HX Edit verification pending (2026-03-05)

### HIGH confidence (official documentation)
- Anthropic prompt caching docs: https://platform.claude.com/docs/en/build-with-claude/prompt-caching — cache structure, TTL, per-workspace isolation, pricing
- Anthropic zodOutputFormat: Zod schema constraint stripping behavior documented in SDK helpers

### MEDIUM confidence (verified from multiple sources)
- HelixHelp community wiki — Stadium hardware capabilities, Helix Rack I/O configuration, device variant differences
- Line 6 Helix Rack product page — rack-mount I/O, VDI availability, confirmed same HX DSP architecture as Floor/LT

---

*Pitfalls research for: HelixTones v5.0 — Device-First Architecture Rework on Live Production App*
*Researched: 2026-03-05*
