// param-dependencies.test.ts — TDD tests for parameter dependency rules
// Phase 82-01, Task 2: RED phase

import { describe, it, expect } from "vitest";
import {
  evaluateDependencies,
  GLOBAL_PARAMETER_DEPENDENCIES,
  type ParamVisibility,
} from "./param-dependencies";

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_VIS: ParamVisibility = {
  visible: true,
  enabled: true,
  dimmed: false,
};

// ---------------------------------------------------------------------------
// GLOBAL_PARAMETER_DEPENDENCIES structure tests
// ---------------------------------------------------------------------------

describe("GLOBAL_PARAMETER_DEPENDENCIES", () => {
  it("is a non-empty array of dependency rules", () => {
    expect(Array.isArray(GLOBAL_PARAMETER_DEPENDENCIES)).toBe(true);
    expect(GLOBAL_PARAMETER_DEPENDENCIES.length).toBeGreaterThan(0);
  });

  it("contains rules for Sync, Link, and ModDepth", () => {
    const controlParams = GLOBAL_PARAMETER_DEPENDENCIES.map(
      (r) => r.controlParam,
    );
    expect(controlParams).toContain("Sync");
    expect(controlParams).toContain("Link");
    expect(controlParams).toContain("ModDepth");
  });
});

// ---------------------------------------------------------------------------
// Sync -> Time/Speed/Interval dependency (DEP-01)
// ---------------------------------------------------------------------------

describe("evaluateDependencies — Sync rules", () => {
  it("Sync=ON (1): hides Time and Speed, shows Interval", () => {
    const result = evaluateDependencies({ Sync: 1, Time: 0.5, Speed: 0.3, Interval: 2 });

    expect(result["Time"].visible).toBe(false);
    expect(result["Speed"].visible).toBe(false);
    expect(result["Interval"].visible).toBe(true);
  });

  it("Sync=ON (true): hides Time and Speed, shows Interval", () => {
    const result = evaluateDependencies({ Sync: true, Time: 0.5, Speed: 0.3, Interval: 2 });

    expect(result["Time"].visible).toBe(false);
    expect(result["Speed"].visible).toBe(false);
    expect(result["Interval"].visible).toBe(true);
  });

  it("Sync=OFF (0): shows Time and Speed, hides Interval", () => {
    const result = evaluateDependencies({ Sync: 0, Time: 0.5, Speed: 0.3, Interval: 2 });

    expect(result["Time"].visible).toBe(true);
    expect(result["Speed"].visible).toBe(true);
    expect(result["Interval"].visible).toBe(false);
  });

  it("Sync=OFF (false): shows Time and Speed, hides Interval", () => {
    const result = evaluateDependencies({ Sync: false, Time: 0.5, Speed: 0.3, Interval: 2 });

    expect(result["Time"].visible).toBe(true);
    expect(result["Speed"].visible).toBe(true);
    expect(result["Interval"].visible).toBe(false);
  });

  it("Sync not present: Time, Speed, Interval default to visible/enabled", () => {
    const result = evaluateDependencies({ Time: 0.5, Speed: 0.3, Interval: 2 });

    expect(result["Time"]).toEqual(DEFAULT_VIS);
    expect(result["Speed"]).toEqual(DEFAULT_VIS);
    expect(result["Interval"]).toEqual(DEFAULT_VIS);
  });

  it("Sync=ON also hides Left Time and Right Time", () => {
    const result = evaluateDependencies({
      Sync: 1,
      "Left Time": 0.5,
      "Right Time": 0.5,
    });

    expect(result["Left Time"].visible).toBe(false);
    expect(result["Right Time"].visible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Link -> Right params dependency (DEP-02)
// ---------------------------------------------------------------------------

describe("evaluateDependencies — Link rules", () => {
  it("Link=ON (1): disables Right Time and Right Feedback", () => {
    const result = evaluateDependencies({
      Link: 1,
      "Right Time": 0.5,
      "Right Feedback": 0.3,
    });

    expect(result["Right Time"].enabled).toBe(false);
    expect(result["Right Feedback"].enabled).toBe(false);
  });

  it("Link=ON (true): disables Right params", () => {
    const result = evaluateDependencies({
      Link: true,
      "Right Time": 0.5,
      "Right Feedback": 0.3,
    });

    expect(result["Right Time"].enabled).toBe(false);
    expect(result["Right Feedback"].enabled).toBe(false);
  });

  it("Link=OFF (0): Right params stay enabled", () => {
    const result = evaluateDependencies({
      Link: 0,
      "Right Time": 0.5,
      "Right Feedback": 0.3,
    });

    expect(result["Right Time"].enabled).toBe(true);
    expect(result["Right Feedback"].enabled).toBe(true);
  });

  it("Link not present: Right params default to enabled", () => {
    const result = evaluateDependencies({
      "Right Time": 0.5,
      "Right Feedback": 0.3,
    });

    expect(result["Right Time"]).toEqual(DEFAULT_VIS);
    expect(result["Right Feedback"]).toEqual(DEFAULT_VIS);
  });

  it("Link=ON also disables RightTime and RightFeedback (no-space variants)", () => {
    const result = evaluateDependencies({
      Link: 1,
      RightTime: 0.5,
      RightFeedback: 0.3,
    });

    expect(result["RightTime"].enabled).toBe(false);
    expect(result["RightFeedback"].enabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ModDepth -> ModSpeed dependency (DEP-03)
// ---------------------------------------------------------------------------

describe("evaluateDependencies — ModDepth rules", () => {
  it("ModDepth=0: ModSpeed is dimmed", () => {
    const result = evaluateDependencies({ ModDepth: 0, ModSpeed: 0.5 });

    expect(result["ModSpeed"].dimmed).toBe(true);
    // Should still be visible and enabled
    expect(result["ModSpeed"].visible).toBe(true);
    expect(result["ModSpeed"].enabled).toBe(true);
  });

  it("ModDepth>0: ModSpeed is not dimmed", () => {
    const result = evaluateDependencies({ ModDepth: 0.5, ModSpeed: 0.5 });

    expect(result["ModSpeed"].dimmed).toBe(false);
  });

  it("ModDepth not present: ModSpeed defaults to normal state", () => {
    const result = evaluateDependencies({ ModSpeed: 0.5 });

    expect(result["ModSpeed"]).toEqual(DEFAULT_VIS);
  });
});

// ---------------------------------------------------------------------------
// General behavior tests
// ---------------------------------------------------------------------------

describe("evaluateDependencies — general behavior", () => {
  it("returns default state for parameters not affected by any rule", () => {
    const result = evaluateDependencies({ Drive: 0.5, Bass: 0.6, Treble: 0.7 });

    expect(result["Drive"]).toEqual(DEFAULT_VIS);
    expect(result["Bass"]).toEqual(DEFAULT_VIS);
    expect(result["Treble"]).toEqual(DEFAULT_VIS);
  });

  it("handles empty parameters object", () => {
    const result = evaluateDependencies({});
    expect(result).toEqual({});
  });

  it("multiple rules can fire simultaneously (Sync + Link)", () => {
    const result = evaluateDependencies({
      Sync: 1,
      Link: 1,
      Time: 0.5,
      "Right Time": 0.5,
      "Right Feedback": 0.3,
      Interval: 2,
    });

    // Sync=ON hides Time, shows Interval
    expect(result["Time"].visible).toBe(false);
    expect(result["Interval"].visible).toBe(true);

    // Link=ON disables Right params
    expect(result["Right Time"].enabled).toBe(false);
    expect(result["Right Feedback"].enabled).toBe(false);
  });

  it("multiple rules on same param: last matching rule wins for each property", () => {
    // Sync=ON hides Right Time (visible: false)
    // Link=ON disables Right Time (enabled: false)
    const result = evaluateDependencies({
      Sync: 1,
      Link: 1,
      "Right Time": 0.5,
    });

    // Sync rule hides it, Link rule disables it — both should apply
    expect(result["Right Time"].visible).toBe(false);
    expect(result["Right Time"].enabled).toBe(false);
  });

  it("rules evaluate against the provided parameter values directly", () => {
    // Sync=0.5 should not trigger Sync=ON or Sync=OFF rules
    // because 0.5 !== 1 and 0.5 !== true and 0.5 !== 0 and 0.5 !== false
    const result = evaluateDependencies({ Sync: 0.5, Time: 0.5 });

    // No Sync rule fires, so Time stays at default
    expect(result["Time"]).toEqual(DEFAULT_VIS);
  });
});
