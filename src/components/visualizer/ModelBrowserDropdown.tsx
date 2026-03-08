"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { BlockSpec } from "@/lib/helix/types";
import {
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
  EQ_MODELS,
  WAH_MODELS,
} from "@/lib/helix/models";
import type { HelixModel } from "@/lib/helix/models";

// ---------------------------------------------------------------------------
// Category definitions — maps UI label to block type and model catalog
// ---------------------------------------------------------------------------

interface ModelCategory {
  label: string;
  type: BlockSpec["type"];
  models: Record<string, HelixModel>;
}

const MODEL_CATEGORIES: ModelCategory[] = [
  { label: "Distortion", type: "distortion", models: DISTORTION_MODELS },
  { label: "Delay", type: "delay", models: DELAY_MODELS },
  { label: "Reverb", type: "reverb", models: REVERB_MODELS },
  { label: "Modulation", type: "modulation", models: MODULATION_MODELS },
  { label: "Dynamics", type: "dynamics", models: DYNAMICS_MODELS },
  { label: "EQ", type: "eq", models: EQ_MODELS },
  { label: "Wah", type: "wah", models: WAH_MODELS },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ModelBrowserDropdownProps {
  /** Target DSP and position where the new block will be added */
  targetDsp: 0 | 1;
  targetPosition: number;
  /** Called when user selects a model */
  onSelect: (blockType: BlockSpec["type"], modelId: string, modelName: string) => void;
  /** Called when dropdown is dismissed */
  onClose: () => void;
  /** Whether adding is disabled (from canAddBlock check) */
  disabled?: boolean;
  /** Reason string when disabled */
  disabledReason?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ModelBrowserDropdown renders a categorized list of effect types for adding
 * new blocks to the signal chain. Each category is collapsible and shows
 * model names from the corresponding catalog.
 *
 * Scoped to categorized dropdown for v7.0 — full search/filter deferred to v7.1.
 */
export function ModelBrowserDropdown({
  onSelect,
  onClose,
  disabled,
  disabledReason,
}: ModelBrowserDropdownProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click-outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleCategoryClick = useCallback((label: string) => {
    setExpandedCategory((prev) => (prev === label ? null : label));
  }, []);

  const handleModelSelect = useCallback(
    (blockType: BlockSpec["type"], model: HelixModel) => {
      onSelect(blockType, model.id, model.name);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <div
      ref={dropdownRef}
      className={[
        "absolute z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto w-56",
        disabled ? "opacity-50 pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="model-browser-dropdown"
    >
      {disabled && disabledReason && (
        <div className="px-3 py-2 text-xs text-red-400">{disabledReason}</div>
      )}

      {MODEL_CATEGORIES.map((category) => (
        <div key={category.label}>
          {/* Category header */}
          <button
            type="button"
            aria-expanded={expandedCategory === category.label}
            aria-label={`${category.label} effects`}
            className="w-full text-left text-xs text-gray-400 uppercase font-mono px-3 py-1.5 sticky top-0 bg-gray-800 hover:text-gray-200 transition-colors flex items-center justify-between"
            onClick={() => handleCategoryClick(category.label)}
          >
            <span>{category.label}</span>
            <span className="text-[10px]">
              {expandedCategory === category.label ? "\u25B2" : "\u25BC"}
            </span>
          </button>

          {/* Expanded model list */}
          {expandedCategory === category.label && (
            <div>
              {Object.values(category.models).map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className="w-full text-left text-sm text-white px-3 py-1.5 hover:bg-gray-700 cursor-pointer"
                  onClick={() => handleModelSelect(category.type, model)}
                >
                  {model.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
