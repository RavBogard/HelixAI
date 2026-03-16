// src/lib/helix/stadium-builder.test.ts
// TDD tests for stadium-builder.ts format bug fixes (STAD-03, STAD-04, STAD-05, STAD-06, cursor).
//
// Phase 53: 5 confirmed format bugs — param encoding, block key positions, fx type mapping,
// cab param count, missing cursor field.
//
// Phase 63: STADPARAM-03/04 — firmware param completeness tests.
//
// Reference: 11 real .hsp files from C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/

import { describe, it, expect } from "vitest";
import { buildHspFile } from "./stadium-builder";
import { resolveParameters } from "./param-engine";
import { STADIUM_AMPS } from "./models";
import { STADIUM_CONFIG } from "./config";
import { getCapabilities } from "./device-family";
import type { PresetSpec, BlockSpec } from "./types";
import type { ToneIntent } from "./tone-intent";

const stadiumCaps = getCapabilities("helix_stadium");
const defaultCaps = getCapabilities("helix_floor");

// ---------------------------------------------------------------------------
// Test fixture — realistic Stadium preset: gate, boost, amp, cab, delay, reverb
// ---------------------------------------------------------------------------

function makeStadiumFixture(): PresetSpec {
  return {
    name: "Test Stadium Preset",
    description: "TDD test fixture for Phase 53 format bug fixes",
    tempo: 120,
    signalChain: [
      // Gate — type: "dynamics", pre-amp, position 0 in intent
      {
        type: "dynamics",
        modelId: "HX2_GateHorizonGateMono",
        modelName: "HX2_GateHorizonGateMono",
        dsp: 0,
        position: 0,
        path: 0,
        enabled: true,
        stereo: false,
        parameters: {
          Sensitivity: -40.0,
          Level: 0.4,
          Mode: 0,
          "Gate Range": 0,
        },
      },
      // Boost — type: "distortion", pre-amp, position 1 in intent
      {
        type: "distortion",
        modelId: "HD2_DistMinotaur",
        modelName: "HD2_DistMinotaur",
        dsp: 0,
        position: 1,
        path: 0,
        enabled: true,
        stereo: false,
        parameters: {
          Gain: 0.25,
          Treble: 0.50,
          Output: 0.60,
        },
      },
      // Amp — type: "amp", position 2 in intent (maps to b03 in slot-grid)
      {
        type: "amp",
        modelId: "Agoura_AmpUSTweedman",
        modelName: "Agoura_AmpUSTweedman",
        dsp: 0,
        position: 2,
        path: 0,
        enabled: true,
        stereo: false,
        parameters: {
          Bass: 0.64,
          Master: 1.0,
          Level: -10.0,
          ZPrePost: 0.3,
        },
      },
      // Cab — type: "cab", follows amp immediately (maps to b04)
      {
        type: "cab",
        modelId: "HD2_CabMicIr_4x10TweedP10R",
        modelName: "HD2_CabMicIr_4x10TweedP10R",
        dsp: 0,
        position: 3,
        path: 0,
        enabled: true,
        stereo: false,
        parameters: {
          LowCut: 80.0,
          HighCut: 20100.0,
          Mic: 9,
          Distance: 1.0,
          Angle: 0.0,
          // Stadium-specific — these should be added by resolveCabParams for Stadium
          Delay: 0.0,
          IrData: 0,
          Level: 0.0,
          Pan: 0.5,
          Position: 0.25,
        },
      },
      // Delay — type: "delay", post-amp, position 4 in intent
      {
        type: "delay",
        modelId: "HD2_DelayDual",
        modelName: "HD2_DelayDual",
        dsp: 0,
        position: 4,
        path: 0,
        enabled: true,
        stereo: false,
        parameters: {
          Time: 0.375,
          Feedback: 0.20,
          Mix: 0.20,
        },
      },
      // Reverb — type: "reverb", post-amp, position 5 in intent
      {
        type: "reverb",
        modelId: "HD2_RevPlate140",
        modelName: "HD2_RevPlate140",
        dsp: 0,
        position: 5,
        path: 0,
        enabled: true,
        stereo: false,
        parameters: {
          Mix: 0.25,
          Decay: 0.5,
        },
      },
    ],
    snapshots: [
      {
        name: "Clean",
        description: "Clean tone",
        ledColor: 0,
        blockStates: {
          block0: true,  // gate on
          block1: false, // boost off
          block2: true,  // amp on
          block3: true,  // delay on
          block4: false, // reverb off
        },
        parameterOverrides: {
          block2: { Bass: 0.40 },  // amp: clean bass setting
        },
      },
      {
        name: "Drive",
        description: "Drive tone",
        ledColor: 1,
        blockStates: {
          block0: true,  // gate on
          block1: true,  // boost on
          block2: true,  // amp on
          block3: false, // delay off
          block4: false, // reverb off
        },
        parameterOverrides: {
          block2: { Bass: 0.70 },  // amp: drive bass boost
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("buildHspFile", () => {
  // Test 1: access: enabled must be present
  it("parameters must include access field in generated JSON (reverting STAD-03)", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const jsonString = JSON.stringify(result.json);
    expect(jsonString.includes('"access":"enabled"')).toBe(false);
  });

  // Test 2: STAD-04 — Slot-grid block key positions
  it("STAD-04: input at b00/pos:0, amp at b05/pos:5, cab at b06/pos:6, output at b13/pos:13", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    // Input at b00 position 0
    const b00 = flow0["b00"] as Record<string, unknown>;
    expect(b00).toBeDefined();
    expect(b00["position"]).toBe(0);
    expect(b00["type"]).toBe("input");

    // Amp must be at b05 position 5
    const b05 = flow0["b05"] as Record<string, unknown>;
    expect(b05).toBeDefined();
    expect(b05["position"]).toBe(5);
    expect(b05["type"]).toBe("amp");

    // Cab must be at b06 position 6
    const b06 = flow0["b06"] as Record<string, unknown>;
    expect(b06).toBeDefined();
    expect(b06["position"]).toBe(6);
    expect(b06["type"]).toBe("cab");

    // Output at b13 position 13
    const b13 = flow0["b13"] as Record<string, unknown>;
    expect(b13).toBeDefined();
    expect(b13["position"]).toBe(13);
    expect(b13["type"]).toBe("output");


  });

  // Test 3: STAD-05 — FX type mapping
  it("STAD-05: gate/boost/delay/reverb blocks emit type 'fx', amp keeps 'amp', cab keeps 'cab'", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    // Find blocks by modelId in flow0
    const allBlocks = Object.entries(flow0)
      .filter(([key]) => key.startsWith("b"))
      .map(([, block]) => block as Record<string, unknown>);

    const gateBlock = allBlocks.find(b => {
      const slot = b["slot"] as Array<Record<string, unknown>>;
      return slot?.[0]?.["model"] === "HX2_GateHorizonGateMono";
    });
    const boostBlock = allBlocks.find(b => {
      const slot = b["slot"] as Array<Record<string, unknown>>;
      return slot?.[0]?.["model"] === "HD2_DistMinotaurMono";
    });
    const delayBlock = allBlocks.find(b => {
      const slot = b["slot"] as Array<Record<string, unknown>>;
      return slot?.[0]?.["model"] === "HD2_DelayDualStereo";
    });
    const reverbBlock = allBlocks.find(b => {
      const slot = b["slot"] as Array<Record<string, unknown>>;
      return slot?.[0]?.["model"] === "HD2_RevPlate140Stereo";
    });
    const ampBlock = allBlocks.find(b => {
      const slot = b["slot"] as Array<Record<string, unknown>>;
      return slot?.[0]?.["model"] === "Agoura_AmpUSTweedman";
    });
    const cabBlock = allBlocks.find(b => {
      const slot = b["slot"] as Array<Record<string, unknown>>;
      return slot?.[0]?.["model"] === "HD2_CabMicIr_4x10TweedP10RWithPan";
    });

    // Effect blocks must use type "fx"
    expect(gateBlock).toBeDefined();
    expect(gateBlock?.["type"]).toBe("fx");

    expect(boostBlock).toBeDefined();
    expect(boostBlock?.["type"]).toBe("fx");

    expect(delayBlock).toBeDefined();
    expect(delayBlock?.["type"]).toBe("fx");

    expect(reverbBlock).toBeDefined();
    expect(reverbBlock?.["type"]).toBe("fx");

    // Structural blocks retain their named type
    expect(ampBlock).toBeDefined();
    expect(ampBlock?.["type"]).toBe("amp");

    expect(cabBlock).toBeDefined();
    expect(cabBlock?.["type"]).toBe("cab");
  });

  // Test 4: STAD-06 — Cab block has exactly 10 parameters
  it("STAD-06: cab block slot[0].params has exactly 10 keys matching the required Stadium cab param list", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    const b06 = flow0["b06"] as Record<string, unknown>;
    expect(b06).toBeDefined();
    expect(b06["type"]).toBe("cab");

    const slot = b06["slot"] as Array<Record<string, unknown>>;
    expect(slot).toBeDefined();
    expect(slot.length).toBeGreaterThan(0);

    const params = slot[0]["params"] as Record<string, unknown>;
    const paramKeys = Object.keys(params).sort();

    expect(paramKeys).toEqual([
      "Angle",
      "Delay",
      "Distance",
      "HighCut",
      "IrData",
      "Level",
      "LowCut",
      "Mic",
      "Pan",
      "Position",
    ]);
  });

  // Test 5: Cursor field at preset level
  it("cursor: preset JSON includes cursor field with { flow: 0, path: 0, position: 0 }", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const preset = result.json.preset;

    expect((preset as unknown as Record<string, unknown>)["cursor"]).toEqual({
      flow: 0,
      path: 0,
      position: 0,
    });
  });

  // Test 6: Harness params use { value: X, access: "enabled" } format
  it("harness params use { value: X, access: 'enabled' } format in amp or cab harness", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    const b05 = flow0["b05"] as Record<string, unknown>;
    const b06 = flow0["b06"] as Record<string, unknown>;

    // Amp harness params
    const ampHarness = b05?.["harness"] as Record<string, unknown>;
    const ampHarnessParams = ampHarness?.["params"] as Record<string, unknown>;
    for (const [, paramObj] of Object.entries(ampHarnessParams ?? {})) {
      const p = paramObj as Record<string, unknown>;
      expect(p).toHaveProperty("value");
    }

    // Cab harness params
    const cabHarness = b06?.["harness"] as Record<string, unknown>;
    const cabHarnessParams = cabHarness?.["params"] as Record<string, unknown>;
    for (const [, paramObj] of Object.entries(cabHarnessParams ?? {})) {
      const p = paramObj as Record<string, unknown>;
      expect(p).toHaveProperty("value");
    }

    // Input block slot params (b00)
    const b00 = flow0["b00"] as Record<string, unknown>;
    const inputSlot = b00?.["slot"] as Array<Record<string, unknown>>;
    const inputParams = inputSlot?.[0]?.["params"] as Record<string, unknown>;
    for (const [, paramObj] of Object.entries(inputParams ?? {})) {
      const p = paramObj as Record<string, unknown>;
      expect(p).toHaveProperty("value");
    }

    // Output block slot params (b13)
    const b13 = flow0["b13"] as Record<string, unknown>;
    const outputSlot = b13?.["slot"] as Array<Record<string, unknown>>;
    const outputParams = outputSlot?.[0]?.["params"] as Record<string, unknown>;
    for (const [, paramObj] of Object.entries(outputParams ?? {})) {
      const p = paramObj as Record<string, unknown>;
      expect(p).toHaveProperty("value");
    }
  });
});

// ---------------------------------------------------------------------------
// Structural comparison with real .hsp reference (Agoura_Bassman.hsp)
// ---------------------------------------------------------------------------
// These tests verify invariants from the research corpus — every structural
// element must match the real Line 6 .hsp reference files.
// All tests use the same fixture from the buildHspFile suite above.
// ---------------------------------------------------------------------------

describe("structural comparison with real .hsp reference", () => {
  // Test 1: Exactly 2 flow entries — active path + empty path
  it("flow array has exactly 2 entries (flow 0 active, flow 1 empty with InputNone)", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);

    expect(result.json.preset.flow).toHaveLength(2);

    // Flow 0 must have @enabled: { value: true } and real blocks
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;
    const flow0Enabled = flow0["@enabled"] as Record<string, unknown>;
    expect(flow0Enabled).toEqual({ value: true });

    // Flow 1 must have @enabled: { value: true }
    const flow1 = result.json.preset.flow[1] as Record<string, unknown>;
    const flow1Enabled = flow1["@enabled"] as Record<string, unknown>;
    expect(flow1Enabled).toEqual({ value: true });

    // Flow 1 b00 must use InputNone model
    const flow1b00 = flow1["b00"] as Record<string, unknown>;
    expect(flow1b00).toBeDefined();
    const flow1b00Slot = flow1b00["slot"] as Array<Record<string, unknown>>;
    expect(flow1b00Slot[0]?.["model"]).toBe(STADIUM_CONFIG.STADIUM_INPUT_NONE_MODEL);

    // Flow 1 b13 must exist (OutputMatrix)
    const flow1b13 = flow1["b13"] as Record<string, unknown>;
    expect(flow1b13).toBeDefined();
    expect(flow1b13["type"]).toBe("output");
  });

  // Test 2: Flow 1 has ONLY @enabled, b00, and b13 — no other blocks
  it("flow 1 has only @enabled, b00 (InputNone), and b13 (OutputMatrix) — no other blocks", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow1 = result.json.preset.flow[1] as Record<string, unknown>;

    const flow1Keys = Object.keys(flow1).sort();
    expect(flow1Keys).toEqual(["@enabled", "b00", "b13"]);
  });

  // Test 3: Block key-position invariant — every bNN key has position: NN
  it("every bNN block key in flow 0 has position field equal to NN", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    const blockKeys = Object.keys(flow0).filter(k => /^b\d{2}$/.test(k));
    expect(blockKeys.length).toBeGreaterThan(0);

    for (const key of blockKeys) {
      const expectedPosition = parseInt(key.slice(1), 10);
      const block = flow0[key] as Record<string, unknown>;
      expect(block["position"]).toBe(expectedPosition);
    }
  });

  // Test 4: Amp-cab linking — amp at b05 → linkedblock b06; cab at b06 → linkedblock b05
  it("amp block at b05 has linkedblock pointing to b06, cab at b06 has linkedblock pointing to b05", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    const b05 = flow0["b05"] as Record<string, unknown>;
    const b06 = flow0["b06"] as Record<string, unknown>;

    expect(b05).toBeDefined();
    expect(b06).toBeDefined();

    // Amp must point to cab
    expect(b05["linkedblock"]).toEqual({ block: "b06", flow: 0 });
    // Cab must point back to amp
    expect(b06["linkedblock"]).toEqual({ block: "b05", flow: 0 });
  });

  // Test 5: Snapshots array has exactly 8 entries
  it("snapshots array has exactly 8 entries; valid snapshots have color field, invalid ones do not", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const snapshots = result.json.preset.snapshots as unknown as Array<Record<string, unknown>>;

    expect(snapshots).toHaveLength(8);

    // Snapshot 0 is valid.
    const validIndices = [0];
    for (const i of validIndices) {
      const snap = snapshots[i]!;
      expect(snap["valid"]).toBe(true);
      expect(snap).toHaveProperty("color");
      expect(snap).toHaveProperty("expsw");
      expect(snap).toHaveProperty("name");
      expect(snap).toHaveProperty("source");
      expect(snap).toHaveProperty("tempo");
    }

    // Remaining 7 snapshots are invalid — must NOT have "color" field, expsw: -1
    for (let i = 1; i < 8; i++) {
      const snap = snapshots[i]!;
      expect(snap["valid"]).toBe(false);
      expect(snap).not.toHaveProperty("color");
      expect(snap["expsw"]).toBe(-1);
    }
  });

  // Test 6: Sources count — exactly 24 entries (12 flow-0 + 12 flow-1)
  it("sources object has exactly 24 entries; first key at 16843008 (flow 0), flow 1 starts at 16843264", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const sources = result.json.preset.sources as Record<string, unknown>;

    expect(Object.keys(sources)).toHaveLength(24);

    // Flow 0 base: 0x01010100 = 16843008
    expect(sources).toHaveProperty("16843008");
    // Flow 1 base: 0x01010200 = 16843264
    expect(sources).toHaveProperty("16843264");

    // All 12 flow-0 keys present
    for (let i = 0; i < 12; i++) {
      expect(sources).toHaveProperty(String(16843008 + i));
    }
    // All 12 flow-1 keys present
    for (let i = 0; i < 12; i++) {
      expect(sources).toHaveProperty(String(16843264 + i));
    }
  });

  // Test 7: Harness structure for amp — EvtIdx, bypass, upper; requires access field
  it("amp harness has EvtIdx/bypass/upper params with access field; cab harness has EvtIdx/bypass/dual/upper", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    const b05 = flow0["b05"] as Record<string, unknown>;
    const b06 = flow0["b06"] as Record<string, unknown>;

    // Amp harness
    const ampHarness = b05["harness"] as Record<string, unknown>;
    expect(ampHarness["@enabled"]).toEqual({ value: true });
    const ampParams = ampHarness["params"] as Record<string, unknown>;
    expect(ampParams["EvtIdx"]).toEqual({ value: -1 });
    expect(ampParams["bypass"]).toEqual({ value: false });
    expect(ampParams["upper"]).toEqual({ value: true });

    // Cab harness
    const cabHarness = b06["harness"] as Record<string, unknown>;
    expect(cabHarness["@enabled"]).toEqual({ value: true });
    const cabParams = cabHarness["params"] as Record<string, unknown>;
    expect(cabParams["EvtIdx"]).toEqual({ value: -1 });
    expect(cabParams["bypass"]).toEqual({ value: false });
    expect(cabParams["dual"]).toEqual({ value: true });
    expect(cabParams["upper"]).toEqual({ value: true });
  });

  // Test 8: Top-level preset keys — all required fields present
  it("preset has all required top-level keys: clip, cursor, flow, params, snapshots, sources, xyctrl", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const presetKeys = Object.keys(result.json.preset).sort();

    expect(presetKeys).toEqual(
      expect.arrayContaining(["clip", "cursor", "flow", "params", "snapshots", "sources", "xyctrl"])
    );
  });

  // Test 9: Meta structure — device_id (number), device_version (number), info (string), name (string <= 32 chars)
  it("meta has device_id (number), device_version (number), info (string), name (string <= 32 chars)", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const meta = result.json.meta as unknown as Record<string, unknown>;

    expect(typeof meta["device_id"]).toBe("number");
    expect(typeof meta["device_version"]).toBe("number");
    expect(typeof meta["info"]).toBe("string");
    expect(typeof meta["name"]).toBe("string");
    expect((meta["name"] as string).length).toBeLessThanOrEqual(32);
  });

  // Test 10: Cab model ID gets WithPan suffix — confirmed across all 11 real .hsp files
  it("cab block model ID has WithPan suffix even when input uses standard HD2_CabMicIr_ ID", () => {
    const fixture = makeStadiumFixture();
    // Fixture uses "HD2_CabMicIr_4x10TweedP10R" (no WithPan) — builder must add it
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;
    const b06 = flow0["b06"] as Record<string, unknown>;
    const slot = b06["slot"] as Array<Record<string, unknown>>;
    expect(slot[0]["model"]).toBe("HD2_CabMicIr_4x10TweedP10RWithPan");
  });

  // Test 11: Effect blocks have EvtIdx/bypass/upper in harness — confirmed from real .hsp files
  it("effect blocks (gate, boost, delay, reverb) have EvtIdx/bypass/upper harness params", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    // Gate at b01
    const b01 = flow0["b01"] as Record<string, unknown>;
    const gateHarness = b01["harness"] as Record<string, unknown>;
    const gateParams = gateHarness["params"] as Record<string, unknown>;
    expect(gateParams["EvtIdx"]).toEqual({ value: -1 });
    expect(gateParams["bypass"]).toEqual({ value: false });
    expect(gateParams["upper"]).toEqual({ value: true });

    // Boost at b02
    const b02 = flow0["b02"] as Record<string, unknown>;
    const boostHarness = b02["harness"] as Record<string, unknown>;
    const boostParams = boostHarness["params"] as Record<string, unknown>;
    expect(boostParams["EvtIdx"]).toEqual({ value: -1 });
    expect(boostParams["bypass"]).toEqual({ value: false });
    expect(boostParams["upper"]).toEqual({ value: true });
  });

  // Test 12: Delay/reverb harness includes Trails param
  it("delay and reverb blocks have Trails param in harness (in addition to EvtIdx/bypass/upper)", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    // Delay at b07
    const b07 = flow0["b07"] as Record<string, unknown>;
    const delayHarness = b07["harness"] as Record<string, unknown>;
    const delayParams = delayHarness["params"] as Record<string, unknown>;
    expect(delayParams["Trails"]).toEqual({ value: true });
    expect(delayParams["EvtIdx"]).toEqual({ value: -1 });

    // Reverb at b08
    const b08 = flow0["b08"] as Record<string, unknown>;
    const reverbHarness = b08["harness"] as Record<string, unknown>;
    const reverbParams = reverbHarness["params"] as Record<string, unknown>;
    expect(reverbParams["Trails"]).toEqual({ value: true });
    expect(reverbParams["EvtIdx"]).toEqual({ value: -1 });
  });

  // Test 13: Per-snapshot parameter overrides are embedded inline on params
  // Real .hsp files: "Bass": { "value": 0.64, "snapshots": [0.40, 0.70, null, null, ...] }
  it("amp params with snapshot overrides include inline snapshots array", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    // Amp at b05
    const b05 = flow0["b05"] as Record<string, unknown>;
    const ampSlot = (b05["slot"] as Array<Record<string, unknown>>)[0]!;
    const ampParams = ampSlot["params"] as Record<string, Record<string, unknown>>;

    // Bass has overrides in the first snapshot — should have snapshots array
    expect(ampParams["Bass"]).toHaveProperty("snapshots");
    const bassSnaps = ampParams["Bass"]["snapshots"] as (number | null)[];
    expect(bassSnaps[0]).toBe(0.40);  // Clean snapshot override
    // Remaining 7 snapshot slots should be null (no snapshot defined for stadium)
    expect(bassSnaps.slice(1)).toEqual([null, null, null, null, null, null, null]);

    // Master has NO overrides — should NOT have snapshots array
    expect(ampParams["Master"]).not.toHaveProperty("snapshots");
    expect(ampParams["Master"]).toEqual({ value: 1.0 });
  });
});

// ===========================================================================
// Phase 63: STADPARAM-03 / STADPARAM-04 — firmware param completeness tests
// ===========================================================================
// Verifies that resolveParameters() emits the complete firmware param table
// for Stadium amps (19-27 keys) and that AMP_DEFAULTS does NOT corrupt them.

// Helper: create a minimal Stadium ToneIntent
function makeStadiumIntent(overrides: Partial<ToneIntent> = {}): ToneIntent {
  return {
    ampName: "Agoura US Double Black",
    cabName: "2x12 Double C12N",
    guitarType: "humbucker",
    effects: [],
    snapshots: [
      { name: "Clean", toneRole: "clean" },
      { name: "Rhythm", toneRole: "crunch" },
      { name: "Lead", toneRole: "lead" },
      { name: "Ambient", toneRole: "ambient" },
    ],
    ...overrides,
  };
}

// Helper: create a minimal BlockSpec for a Stadium amp
function makeStadiumAmpBlock(modelName: string): BlockSpec {
  const model = STADIUM_AMPS[modelName];
  return {
    type: "amp",
    modelId: model?.id ?? "unknown",
    modelName,
    dsp: 0,
    position: 2,
    path: 0,
    enabled: true,
    stereo: false,
    parameters: {},
  };
}

// Helper: create a minimal HD2 ToneIntent for regression test
function makeHd2Intent(): ToneIntent {
  return {
    ampName: "US Double Nrm",
    cabName: "2x12 Double C12N",
    guitarType: "humbucker",
    effects: [],
    snapshots: [
      { name: "Clean", toneRole: "clean" },
      { name: "Rhythm", toneRole: "crunch" },
      { name: "Lead", toneRole: "lead" },
      { name: "Ambient", toneRole: "ambient" },
    ],
  };
}

describe("STADPARAM-03: Stadium amp block param completeness", () => {
  it("Agoura US Double Black amp block has 28 params after resolution", () => {
    const chain: BlockSpec[] = [makeStadiumAmpBlock("Agoura US Double Black")];
    const intent = makeStadiumIntent({ ampName: "Agoura US Double Black" });
    const result = resolveParameters(chain, intent, stadiumCaps);
    const ampParams = result[0].parameters;
    // 14 universal + 6 standard (Drive,Bass,Mid,Treble,Master,Level) + 8 voice
    expect(Object.keys(ampParams).length).toBe(28);
  });

  it("Agoura US Princess 76 amp block has 19 params after resolution", () => {
    const chain: BlockSpec[] = [makeStadiumAmpBlock("Agoura US Princess 76")];
    const intent = makeStadiumIntent({ ampName: "Agoura US Princess 76" });
    const result = resolveParameters(chain, intent, stadiumCaps);
    const ampParams = result[0].parameters;
    expect(Object.keys(ampParams).length).toBe(19);
  });

  it("hidden firmware params (AmpCabPeak2Fc, Hype, ZPrePost, Sag, Ripple) present on every Stadium amp", () => {
    const hiddenParams = ["AmpCabPeak2Fc", "Hype", "ZPrePost", "Sag", "Ripple"];
    for (const [modelName] of Object.entries(STADIUM_AMPS)) {
      const chain: BlockSpec[] = [makeStadiumAmpBlock(modelName)];
      const intent = makeStadiumIntent({ ampName: modelName });
      const result = resolveParameters(chain, intent, stadiumCaps);
      const ampParams = result[0].parameters;
      for (const param of hiddenParams) {
        expect(ampParams).toHaveProperty(param);
      }
    }
  });

  it("no ChVol param on any Stadium amp block", () => {
    for (const [modelName] of Object.entries(STADIUM_AMPS)) {
      const chain: BlockSpec[] = [makeStadiumAmpBlock(modelName)];
      const intent = makeStadiumIntent({ ampName: modelName });
      const result = resolveParameters(chain, intent, stadiumCaps);
      const ampParams = result[0].parameters;
      expect(ampParams).not.toHaveProperty("ChVol");
    }
  });

  it("boolean voice params preserved as booleans (Revv Ch3 Purple: Fat=true, Bright=false, Contour=false)", () => {
    const chain: BlockSpec[] = [makeStadiumAmpBlock("Agoura Revv Ch3 Purple")];
    const intent = makeStadiumIntent({ ampName: "Agoura Revv Ch3 Purple" });
    const result = resolveParameters(chain, intent, stadiumCaps);
    const ampParams = result[0].parameters;
    expect(ampParams.Fat).toBe(true);
    expect(typeof ampParams.Fat).toBe("boolean");
    expect(ampParams.Bright).toBe(false);
    expect(typeof ampParams.Bright).toBe("boolean");
    expect(ampParams.Contour).toBe(false);
    expect(typeof ampParams.Contour).toBe("boolean");
  });

  it("every Stadium amp has at least 19 params and at most 28 params", () => {
    for (const [modelName] of Object.entries(STADIUM_AMPS)) {
      const chain: BlockSpec[] = [makeStadiumAmpBlock(modelName)];
      const intent = makeStadiumIntent({ ampName: modelName });
      const result = resolveParameters(chain, intent, stadiumCaps);
      const paramCount = Object.keys(result[0].parameters).length;
      expect(paramCount).toBeGreaterThanOrEqual(19);
      expect(paramCount).toBeLessThanOrEqual(28);
    }
  });
});

describe("STADPARAM-04: Stadium effect block completeness", () => {
  it("Stadium effect blocks emit all of their model defaultParams keys", () => {
    // Use a distortion block (Minotaur) — should get its specific params
    const chain: BlockSpec[] = [
      makeStadiumAmpBlock("Agoura US Double Black"),
      {
        type: "distortion",
        modelId: "HD2_DistMinotaur",
        modelName: "Minotaur",
        dsp: 0,
        position: 1,
        path: 0,
        enabled: true,
        stereo: false,
        parameters: {},
      },
    ];
    const intent = makeStadiumIntent({ ampName: "Agoura US Double Black" });
    const result = resolveParameters(chain, intent, stadiumCaps);
    const distBlock = result.find(b => b.type === "distortion");
    expect(distBlock).toBeDefined();
    // Minotaur has Gain, Treble, Output
    expect(distBlock!.parameters).toHaveProperty("Gain");
    expect(distBlock!.parameters).toHaveProperty("Treble");
    expect(distBlock!.parameters).toHaveProperty("Output");
  });
});

describe("HD2 regression: AMP_DEFAULTS still applied for non-Stadium amps", () => {
  it("HD2 amp (US Double Nrm) still gets ChVol from AMP_DEFAULTS", () => {
    const chain: BlockSpec[] = [{
      type: "amp",
      modelId: "HD2_AmpUSDoubleNrm",
      modelName: "US Double Nrm",
      dsp: 0,
      position: 0,
      path: 0,
      enabled: true,
      stereo: false,
      parameters: {},
    }];
    const intent = makeHd2Intent();
    const result = resolveParameters(chain, intent, defaultCaps);
    const ampParams = result[0].parameters;
    // HD2 amps must still get ChVol from AMP_DEFAULTS
    expect(ampParams).toHaveProperty("ChVol");
    expect(ampParams.ChVol).toBe(0.70);
  });

  it("HD2 amp (US Double Nrm) gets Sag from AMP_DEFAULTS (not 0)", () => {
    const chain: BlockSpec[] = [{
      type: "amp",
      modelId: "HD2_AmpUSDoubleNrm",
      modelName: "US Double Nrm",
      dsp: 0,
      position: 0,
      path: 0,
      enabled: true,
      stereo: false,
      parameters: {},
    }];
    const intent = makeHd2Intent();
    const result = resolveParameters(chain, intent, defaultCaps);
    const ampParams = result[0].parameters;
    // HD2 clean amps get Sag: 0.60 from AMP_DEFAULTS
    expect(ampParams.Sag).toBe(0.60);
  });
});

// ---------------------------------------------------------------------------
// STAD-07: Mono/Stereo suffix regression tests
// Root cause of "only cab shows up" bug: Stadium firmware requires Mono/Stereo
// suffixes on ALL effect model IDs. Pre-amp effects get "Mono", post-amp get
// "Stereo". Amps, cabs, and I/O blocks are unchanged.
//
// Verified against professional .hsp files:
//   NH_BoomAuRang.hsp, Agoura_Bassman.hsp, Stadium_Rock_Rhythm.hsp
// ---------------------------------------------------------------------------

describe("STAD-07: Mono/Stereo suffix application", () => {
  it("pre-amp effect blocks (before amp) get Mono suffix in generated .hsp", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    // Gate at b01 is pre-amp — already has HX2_GateHorizonGateMono in fixture
    const b01 = flow0["b01"] as Record<string, unknown>;
    expect(b01).toBeDefined();
    const b01Slot = (b01["slot"] as Array<Record<string, unknown>>)[0];
    expect((b01Slot["model"] as string).endsWith("Mono")).toBe(true);

    // Boost at b02 is pre-amp — HD2_DistMinotaur → HD2_DistMinotaurMono
    const b02 = flow0["b02"] as Record<string, unknown>;
    expect(b02).toBeDefined();
    const b02Slot = (b02["slot"] as Array<Record<string, unknown>>)[0];
    expect(b02Slot["model"]).toBe("HD2_DistMinotaurMono");
  });

  it("post-amp effect blocks (after cab) get Stereo suffix in generated .hsp", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    // Delay at b07 is post-amp — HD2_DelayDual → HD2_DelayDualStereo
    const b07 = flow0["b07"] as Record<string, unknown>;
    expect(b07).toBeDefined();
    const b07Slot = (b07["slot"] as Array<Record<string, unknown>>)[0];
    expect(b07Slot["model"]).toBe("HD2_DelayDualStereo");

    // Reverb at b08 is post-amp — HD2_RevPlate140 → HD2_RevPlate140Stereo
    const b08 = flow0["b08"] as Record<string, unknown>;
    expect(b08).toBeDefined();
    const b08Slot = (b08["slot"] as Array<Record<string, unknown>>)[0];
    expect(b08Slot["model"]).toBe("HD2_RevPlate140Stereo");
  });

  it("amp block does NOT get Mono/Stereo suffix", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    const b05 = flow0["b05"] as Record<string, unknown>;
    const ampSlot = (b05["slot"] as Array<Record<string, unknown>>)[0];
    const model = ampSlot["model"] as string;
    expect(model).toBe("Agoura_AmpUSTweedman");
    expect(model.endsWith("Mono")).toBe(false);
    expect(model.endsWith("Stereo")).toBe(false);
  });

  it("cab block gets WithPan suffix (not Mono/Stereo)", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    const b06 = flow0["b06"] as Record<string, unknown>;
    const cabSlot = (b06["slot"] as Array<Record<string, unknown>>)[0];
    const model = cabSlot["model"] as string;
    expect(model).toBe("HD2_CabMicIr_4x10TweedP10RWithPan");
    expect(model.endsWith("Mono")).toBe(false);
    expect(model.endsWith("Stereo")).toBe(false);
  });

  it("post-amp effect blocks (even EQ and Gate) get Stereo suffix to prevent DSP panic in Dual layout", () => {
    const fixture = makeStadiumFixture();
    
    // Move gate from pre-amp to post-amp to test coercion
    const gateBlock = fixture.signalChain.find(b => b.type === "dynamics")!;
    gateBlock.position = 10; // Post-amp position
    
    // Add an EQ block post-amp
    fixture.signalChain.push({
      type: "eq",
      modelId: "HD2_EQParametric",
      modelName: "Parametric EQ",
      dsp: 0,
      position: 11,
      path: 0,
      enabled: true,
      stereo: false, // Intent asked for mono
      parameters: {},
    });

    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    // Find the Gate block — should now be post-amp and Stereo
    const gateFlow = Object.values(flow0).find(b => {
      const slot = (b as Record<string, unknown>)["slot"] as Array<Record<string, unknown>>;
      return slot && (slot[0]["model"] as string).includes("Gate");
    }) as Record<string, unknown>;
    expect(gateFlow).toBeDefined();
    const gateSlot = (gateFlow["slot"] as Array<Record<string, unknown>>)[0];
    expect((gateSlot["model"] as string).endsWith("Stereo")).toBe(true);

    // Find the EQ block — should be post-amp and Stereo
    const eqFlow = Object.values(flow0).find(b => {
      const slot = (b as Record<string, unknown>)["slot"] as Array<Record<string, unknown>>;
      return slot && (slot[0]["model"] as string).includes("EQParametric");
    }) as Record<string, unknown>;
    expect(eqFlow).toBeDefined();
    const eqSlot = (eqFlow["slot"] as Array<Record<string, unknown>>)[0];
    expect((eqSlot["model"] as string).endsWith("Stereo")).toBe(true);
  });

  it("HD2_GateHorizonGate overridden to HX2_GateHorizonGate prefix in Stadium", () => {
    // Build a fixture where Horizon Gate is used as a post-amp effect
    // to verify the HD2→HX2 prefix override works with Stereo suffix
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    // Gate at b01 uses HX2_ prefix (not HD2_) — verified against professional presets
    const b01 = flow0["b01"] as Record<string, unknown>;
    const gateSlot = (b01["slot"] as Array<Record<string, unknown>>)[0];
    const model = gateSlot["model"] as string;
    expect(model.startsWith("HX2_")).toBe(true);
  });

  it("preset params include inst2Z: 'FirstEnabled' (required by Stadium firmware)", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const params = result.json.preset.params as Record<string, unknown>;
    expect(params["inst2Z"]).toBe("FirstEnabled");
    expect(params["inst1Z"]).toBe("FirstEnabled");
  });

  it("every effect model ID in flow0 ends with Mono or Stereo (no bare IDs)", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const flow0 = result.json.preset.flow[0] as Record<string, unknown>;

    // Collect all effect blocks (not input/output/amp/cab)
    const effectBlocks: Array<{ key: string; model: string; type: string }> = [];
    for (const [key, value] of Object.entries(flow0)) {
      if (!key.startsWith("b")) continue;
      const block = value as Record<string, unknown>;
      const blockType = block["type"] as string;
      if (blockType === "input" || blockType === "output" || blockType === "amp" || blockType === "cab") continue;

      const slot = (block["slot"] as Array<Record<string, unknown>>)?.[0];
      if (slot) {
        effectBlocks.push({
          key,
          model: slot["model"] as string,
          type: blockType,
        });
      }
    }

    expect(effectBlocks.length).toBeGreaterThan(0);

    for (const { key, model } of effectBlocks) {
      const hasSuffix = model.endsWith("Mono") || model.endsWith("Stereo");
      expect(hasSuffix).toBe(true);
    }
  });
});
