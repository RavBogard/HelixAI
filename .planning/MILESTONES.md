# Milestones: HelixAI

## v1.0 — Full Rebuild (Complete)

**Goal:** Rebuild the preset engine from scratch to produce world-class, mix-ready tones.

**Shipped:**
- Foundation types, verified @type constants, expanded model database
- Knowledge Layer: chain rules, param engine, snapshot engine (50 tests)
- AI Integration: Claude Sonnet 4.6 with constrained ToneIntent structured output
- Orchestration: end-to-end .hlx generation with strict validation
- Frontend Polish: device selector (LT/Floor), single-preset UX, Warm Analog Studio design
- Hardening: firmware config parameterization, DSP limit enforcement, openai removal

**Phases:** 1-6 (14 plans total)
**Completed:** 2026-03-02

## v1.1 — Polish & Precision (Complete)

**Goal:** Fix hardware-facing bugs, deepen preset intelligence, and give users a window into what they're downloading.

**Shipped:**
- Hardware bug fixes: @fs_enabled, @pedalstate bitmask, .hlx format audit
- Prompt caching for ~50% API input cost reduction
- Genre-aware effect parameter defaults (delay time, reverb mix, modulation rate)
- Smarter snapshot effect toggling via intentRole
- Signal chain visualization + tone description card
- Daniel Bogard branding footer

**Phases:** 7-11 (7 plans total)
**Completed:** 2026-03-02

## v1.2 — Pod Go Support (Complete)

**Goal:** Extend HelixAI to generate presets for Line 6 Pod Go — a single-DSP device with different block limits, file format, and model catalog. Pod Go presets must match the same professional tone quality standard as Helix presets.

**Shipped:**
- Pod Go file format (.pgp) with correct device ID, block types, and I/O structure
- Pod Go model catalog with Mono/Stereo suffixed effect IDs and device-filtered model list
- Device-aware chain rules (single DSP, 4-effect limit, no auto-inserted EQ/Gain blocks)
- Pod Go preset builder with 4 volume-balanced snapshots and shared param-engine quality
- Pod Go in device selector UI with .pgp download and 4-snapshot display

**Phases:** 12-16
**Completed:** 2026-03-02

## v1.3 — Rig Emulation (Complete)

**Goal:** Extend the tone interview to accept physical rig descriptions — text, pedal photos, or both — and generate a Helix/Pod Go preset that emulates the user's actual gear with transparent substitution mapping.

**Shipped:**
- Zod schemas for rig intent, physical pedal, substitution entry/map
- Pedal mapping engine with 53-entry curated table and 3-tier match logic
- Vision extraction API via Claude Sonnet 4.6 with client-side image compression
- Planner integration with toneContext injection and text rig parsing
- Substitution card UI with progressive loading states
- Works for Helix LT, Helix Floor, and Pod Go

**Phases:** 17-21 (5 plans total)
**Completed:** 2026-03-02

---
*Last updated: 2026-03-03*
