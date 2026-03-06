// src/lib/prompt-router.ts
// Central dispatcher: DeviceTarget -> family prompt module.
// API routes import from this router, not from individual family files.

import type { DeviceTarget } from "@/lib/helix/types";
import { resolveFamily } from "@/lib/helix";
import type { DeviceFamily } from "@/lib/helix";
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

export type { DeviceFamily };

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
