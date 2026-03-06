// src/lib/prompt-router.ts
// Central dispatcher: DeviceTarget -> family prompt module.
// API routes import from this router, not from individual family files.

import type { DeviceTarget } from "@/lib/helix/types";
import {
  buildPlannerPrompt as helixPlannerPrompt,
  getSystemPrompt as helixChatPrompt,
} from "./families/helix/prompt";
import {
  buildPlannerPrompt as stompPlannerPrompt,
  getSystemPrompt as stompChatPrompt,
} from "./families/stomp/prompt";
import {
  buildPlannerPrompt as podgoPlannerPrompt,
  getSystemPrompt as podgoChatPrompt,
} from "./families/podgo/prompt";
import {
  buildPlannerPrompt as stadiumPlannerPrompt,
  getSystemPrompt as stadiumChatPrompt,
} from "./families/stadium/prompt";

/** Device family grouping — maps multiple DeviceTargets to a single prompt module. */
export type DeviceFamily = "helix" | "stomp" | "podgo" | "stadium";

// TODO(Phase61): replace with canonical resolveFamily() from @/lib/helix/family-router
/**
 * Resolve a DeviceTarget to its DeviceFamily.
 * Inline implementation until Phase 61 ships the canonical version.
 */
function resolveFamily(device: DeviceTarget): DeviceFamily {
  switch (device) {
    case "helix_lt":
    case "helix_floor":
      return "helix";
    case "helix_stomp":
    case "helix_stomp_xl":
      return "stomp";
    case "pod_go":
      return "podgo";
    case "helix_stadium":
      return "stadium";
  }
}

/**
 * Get the per-family planner system prompt for a device.
 * Uses exhaustive switch — TypeScript compiler rejects missing families.
 */
export function getFamilyPlannerPrompt(device: DeviceTarget, modelList: string): string {
  const family = resolveFamily(device);
  switch (family) {
    case "helix":
      return helixPlannerPrompt(device, modelList);
    case "stomp":
      return stompPlannerPrompt(device, modelList);
    case "podgo":
      return podgoPlannerPrompt(device, modelList);
    case "stadium":
      return stadiumPlannerPrompt(device, modelList);
  }
}

/**
 * Get the per-family chat system prompt for a device.
 * Uses exhaustive switch — TypeScript compiler rejects missing families.
 */
export function getFamilyChatPrompt(device: DeviceTarget): string {
  const family = resolveFamily(device);
  switch (family) {
    case "helix":
      return helixChatPrompt(device);
    case "stomp":
      return stompChatPrompt(device);
    case "podgo":
      return podgoChatPrompt(device);
    case "stadium":
      return stadiumChatPrompt(device);
  }
}
