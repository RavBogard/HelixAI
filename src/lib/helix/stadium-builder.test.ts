// src/lib/helix/stadium-builder.test.ts
// TDD tests for stadium-builder.ts format bug fixes (STAD-03, STAD-04, STAD-05, STAD-06, cursor).
//
// Phase 53: 5 confirmed format bugs — param encoding, block key positions, fx type mapping,
// cab param count, missing cursor field.
//
// Reference: 11 real .hsp files from C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/

import { describe, it, expect } from "vitest";
import { buildHspFile } from "./stadium-builder";
import type { PresetSpec } from "./types";

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
      // Amp — type: "amp", position 2 in intent (maps to b05 in slot-grid)
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
      // Cab — type: "cab", follows amp immediately (maps to b06)
      {
        type: "cab",
        modelId: "HD2_CabMicIr_4x10TweedP10RWithPan",
        modelName: "HD2_CabMicIr_4x10TweedP10RWithPan",
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
        parameterOverrides: {},
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
        parameterOverrides: {},
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("buildHspFile", () => {
  // Test 1: STAD-03 — No access field anywhere
  it("STAD-03: zero occurrences of 'access' field in generated JSON", () => {
    const fixture = makeStadiumFixture();
    const result = buildHspFile(fixture);
    const jsonString = JSON.stringify(result.json);
    expect(jsonString.includes('"access"')).toBe(false);
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

    // Amp must NOT be at b03 (sequential counter bug: gate+boost+amp = position 3)
    const b03 = flow0["b03"] as Record<string, unknown> | undefined;
    if (b03 !== undefined) {
      // b03 may exist (for a pre-amp effect) but must NOT be an amp
      expect(b03["type"]).not.toBe("amp");
    }
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
      return slot?.[0]?.["model"] === "HD2_DistMinotaur";
    });
    const delayBlock = allBlocks.find(b => {
      const slot = b["slot"] as Array<Record<string, unknown>>;
      return slot?.[0]?.["model"] === "HD2_DelayDual";
    });
    const reverbBlock = allBlocks.find(b => {
      const slot = b["slot"] as Array<Record<string, unknown>>;
      return slot?.[0]?.["model"] === "HD2_RevPlate140";
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

    // Test 6: Harness params use { value: X } format (no access field)
  it("STAD-03: harness params use { value: X } format — no access field in amp or cab harness", () => {
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
      expect(p).not.toHaveProperty("access");
      expect(p).toHaveProperty("value");
    }

    // Cab harness params
    const cabHarness = b06?.["harness"] as Record<string, unknown>;
    const cabHarnessParams = cabHarness?.["params"] as Record<string, unknown>;
    for (const [, paramObj] of Object.entries(cabHarnessParams ?? {})) {
      const p = paramObj as Record<string, unknown>;
      expect(p).not.toHaveProperty("access");
      expect(p).toHaveProperty("value");
    }

    // Input block slot params (b00)
    const b00 = flow0["b00"] as Record<string, unknown>;
    const inputSlot = b00?.["slot"] as Array<Record<string, unknown>>;
    const inputParams = inputSlot?.[0]?.["params"] as Record<string, unknown>;
    for (const [, paramObj] of Object.entries(inputParams ?? {})) {
      const p = paramObj as Record<string, unknown>;
      expect(p).not.toHaveProperty("access");
      expect(p).toHaveProperty("value");
    }

    // Output block slot params (b13)
    const b13 = flow0["b13"] as Record<string, unknown>;
    const outputSlot = b13?.["slot"] as Array<Record<string, unknown>>;
    const outputParams = outputSlot?.[0]?.["params"] as Record<string, unknown>;
    for (const [, paramObj] of Object.entries(outputParams ?? {})) {
      const p = paramObj as Record<string, unknown>;
      expect(p).not.toHaveProperty("access");
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
    expect(flow1b00Slot[0]?.["model"]).toBe("P35_InputNone");

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
    const snapshots = result.json.preset.snapshots as Array<Record<string, unknown>>;

    expect(snapshots).toHaveLength(8);

    // Fixture has 2 valid snapshots ("Clean" and "Drive") → indices 0..1 are valid
    const validIndices = [0, 1];
    for (const i of validIndices) {
      const snap = snapshots[i]!;
      expect(snap["valid"]).toBe(true);
      expect(snap).toHaveProperty("color");
      expect(snap).toHaveProperty("expsw");
      expect(snap).toHaveProperty("name");
      expect(snap).toHaveProperty("source");
      expect(snap).toHaveProperty("tempo");
    }

    // Remaining 6 snapshots are invalid — must NOT have "color" field, expsw: -1
    for (let i = 2; i < 8; i++) {
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

  // Test 7: Harness structure for amp — EvtIdx, bypass, upper; no access field
  it("amp harness has EvtIdx/bypass/upper params with no access field; cab harness has EvtIdx/bypass/dual/upper", () => {
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
    // No access field in any amp harness param
    for (const [, v] of Object.entries(ampParams)) {
      expect(v as Record<string, unknown>).not.toHaveProperty("access");
    }

    // Cab harness
    const cabHarness = b06["harness"] as Record<string, unknown>;
    expect(cabHarness["@enabled"]).toEqual({ value: true });
    const cabParams = cabHarness["params"] as Record<string, unknown>;
    expect(cabParams["EvtIdx"]).toEqual({ value: -1 });
    expect(cabParams["bypass"]).toEqual({ value: false });
    expect(cabParams["dual"]).toEqual({ value: true });
    expect(cabParams["upper"]).toEqual({ value: true });
    // No access field in any cab harness param
    for (const [, v] of Object.entries(cabParams)) {
      expect(v as Record<string, unknown>).not.toHaveProperty("access");
    }
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
    const meta = result.json.meta as Record<string, unknown>;

    expect(typeof meta["device_id"]).toBe("number");
    expect(typeof meta["device_version"]).toBe("number");
    expect(typeof meta["info"]).toBe("string");
    expect(typeof meta["name"]).toBe("string");
    expect((meta["name"] as string).length).toBeLessThanOrEqual(32);
  });
});
