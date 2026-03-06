// src/lib/prompt-router.test.ts
// Prompt router dispatch tests.
// Verifies all 6 DeviceTarget values dispatch to correct family and return non-empty strings.

import { describe, it, expect } from "vitest";
import { getFamilyPlannerPrompt, getFamilyChatPrompt } from "./prompt-router";
import type { DeviceTarget } from "@/lib/helix";

const sampleModelList = "## AMPS\n- TestAmp1\n- TestAmp2\n## CABS\n- TestCab1";

const ALL_DEVICES: DeviceTarget[] = [
  "helix_lt",
  "helix_floor",
  "helix_stomp",
  "helix_stomp_xl",
  "pod_go",
  "helix_stadium",
];

describe("getFamilyPlannerPrompt", () => {
  for (const device of ALL_DEVICES) {
    it(`returns non-empty string for ${device}`, () => {
      const result = getFamilyPlannerPrompt(device, sampleModelList);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(100);
    });
  }

  it("different families return different planner prompt text", () => {
    const helixPrompt = getFamilyPlannerPrompt("helix_lt", sampleModelList);
    const stompPrompt = getFamilyPlannerPrompt("helix_stomp", sampleModelList);
    const podgoPrompt = getFamilyPlannerPrompt("pod_go", sampleModelList);
    const stadiumPrompt = getFamilyPlannerPrompt("helix_stadium", sampleModelList);

    expect(helixPrompt).not.toBe(stompPrompt);
    expect(helixPrompt).not.toBe(podgoPrompt);
    expect(helixPrompt).not.toBe(stadiumPrompt);
    expect(stompPrompt).not.toBe(podgoPrompt);
  });

  it("helix_lt and helix_floor return identical planner prompt", () => {
    const ltPrompt = getFamilyPlannerPrompt("helix_lt", sampleModelList);
    const floorPrompt = getFamilyPlannerPrompt("helix_floor", sampleModelList);
    expect(ltPrompt).toBe(floorPrompt);
  });
});

describe("getFamilyChatPrompt", () => {
  for (const device of ALL_DEVICES) {
    it(`returns non-empty string for ${device}`, () => {
      const result = getFamilyChatPrompt(device);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(100);
    });
  }

  it("different families return different chat prompt text", () => {
    const helixPrompt = getFamilyChatPrompt("helix_lt");
    const stompPrompt = getFamilyChatPrompt("helix_stomp");
    const podgoPrompt = getFamilyChatPrompt("pod_go");
    const stadiumPrompt = getFamilyChatPrompt("helix_stadium");

    expect(helixPrompt).not.toBe(stompPrompt);
    expect(helixPrompt).not.toBe(podgoPrompt);
    expect(helixPrompt).not.toBe(stadiumPrompt);
    expect(stompPrompt).not.toBe(podgoPrompt);
  });

  it("helix_lt and helix_floor return identical chat prompt", () => {
    const ltPrompt = getFamilyChatPrompt("helix_lt");
    const floorPrompt = getFamilyChatPrompt("helix_floor");
    expect(ltPrompt).toBe(floorPrompt);
  });
});
