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
