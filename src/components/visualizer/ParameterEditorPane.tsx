"use client";

import { useCallback } from "react";
import {
  useVisualizerStore,
  getEffectiveBlockState,
} from "@/lib/visualizer/store";
import {
  PARAMETER_SCHEMA,
  toDisplayValue,
  fromDisplayValue,
  getVisibleParameters,
  type ParameterSchemaDef,
} from "@/lib/visualizer/parameter-schema";
import {
  AMP_MODELS,
  CAB_MODELS,
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
  EQ_MODELS,
  WAH_MODELS,
  VOLUME_MODELS,
} from "@/lib/helix/models";
import type { HelixModel } from "@/lib/helix/models";
import type { BlockSpec } from "@/lib/helix/types";
import { getControllerForParam } from "@/lib/visualizer/controller-assignments";
import type { ControllerAssignment } from "@/lib/visualizer/controller-assignments";
import { evaluateDependencies } from "@/lib/visualizer/param-dependencies";

// ---------------------------------------------------------------------------
// Model catalogs by block type — for model swap dropdown
// ---------------------------------------------------------------------------

const MODEL_CATALOGS_BY_TYPE: Partial<
  Record<BlockSpec["type"], Record<string, HelixModel>>
> = {
  amp: AMP_MODELS,
  cab: CAB_MODELS,
  distortion: DISTORTION_MODELS,
  delay: DELAY_MODELS,
  reverb: REVERB_MODELS,
  modulation: MODULATION_MODELS,
  dynamics: DYNAMICS_MODELS,
  eq: EQ_MODELS,
  wah: WAH_MODELS,
  volume: VOLUME_MODELS,
};

// Default percentage schema for unknown parameter keys
const DEFAULT_SCHEMA: ParameterSchemaDef = {
  type: "percentage",
  min: 0,
  max: 100,
  step: 1,
  unit: "%",
  displayMultiplier: 100,
  displayOffset: 0,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SliderControl({
  paramKey,
  rawValue,
  schema,
  onChange,
}: {
  paramKey: string;
  rawValue: number;
  schema: ParameterSchemaDef;
  onChange: (key: string, value: number) => void;
}) {
  const displayValue = toDisplayValue(rawValue, schema);
  const formatted =
    schema.step >= 1
      ? Math.round(displayValue).toString()
      : displayValue.toFixed(1);

  return (
    <div className="flex flex-col gap-1" data-testid={`param-slider-${paramKey}`}>
      <div className="flex justify-between items-center">
        <label className="text-xs text-gray-400 uppercase">{paramKey}</label>
        <span className="text-sm text-white font-mono">
          {formatted}
          {schema.unit}
        </span>
      </div>
      <input
        type="range"
        min={schema.min}
        max={schema.max}
        step={schema.step}
        value={displayValue}
        onChange={(e) => {
          const newDisplayValue = parseFloat(e.target.value);
          const newRaw = fromDisplayValue(newDisplayValue, schema);
          onChange(paramKey, newRaw);
        }}
        className="w-full accent-blue-500"
        aria-label={`${paramKey} slider`}
      />
    </div>
  );
}

function ToggleControl({
  paramKey,
  value,
  onChange,
}: {
  paramKey: string;
  value: boolean;
  onChange: (key: string, value: boolean) => void;
}) {
  return (
    <div
      className="flex justify-between items-center"
      data-testid={`param-toggle-${paramKey}`}
    >
      <label className="text-xs text-gray-400 uppercase">{paramKey}</label>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={`${paramKey} toggle`}
        onClick={() => onChange(paramKey, !value)}
        className={`w-10 h-5 rounded-full transition-colors ${
          value ? "bg-blue-500" : "bg-gray-600"
        } relative`}
      >
        <span
          className={`block w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function DropdownControl({
  paramKey,
  rawValue,
  schema,
  onChange,
}: {
  paramKey: string;
  rawValue: number;
  schema: ParameterSchemaDef;
  onChange: (key: string, value: number) => void;
}) {
  const options = schema.options ?? [];

  return (
    <div className="flex flex-col gap-1" data-testid={`param-dropdown-${paramKey}`}>
      <label className="text-xs text-gray-400 uppercase">{paramKey}</label>
      <select
        value={rawValue}
        onChange={(e) => onChange(paramKey, parseInt(e.target.value, 10))}
        className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1"
        aria-label={`${paramKey} dropdown`}
      >
        {options.map((opt, idx) => (
          <option key={idx} value={idx}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function DualHandleSlider({
  paramKey,
  assignment,
  schema,
}: {
  paramKey: string;
  assignment: ControllerAssignment;
  schema: ParameterSchemaDef;
}) {
  const minDisplay = toDisplayValue(assignment.min, schema);
  const maxDisplay = toDisplayValue(assignment.max, schema);
  const minFormatted =
    schema.step >= 1
      ? Math.round(minDisplay).toString()
      : minDisplay.toFixed(1);
  const maxFormatted =
    schema.step >= 1
      ? Math.round(maxDisplay).toString()
      : maxDisplay.toFixed(1);

  return (
    <div
      className="flex flex-col gap-1"
      data-testid={`param-dual-slider-${paramKey}`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-400 uppercase">{paramKey}</label>
          <span
            className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded"
            data-testid={`controller-badge-${paramKey}`}
          >
            {assignment.controller}
          </span>
        </div>
        <span className="text-sm text-white font-mono">
          {minFormatted}&ndash;{maxFormatted}
          {schema.unit}
        </span>
      </div>
      {/* Read-only dual range visualization */}
      <div className="relative w-full h-2 bg-gray-700 rounded">
        <div
          className="absolute h-full bg-blue-500/40 rounded"
          style={{
            left: `${assignment.min * 100}%`,
            width: `${(assignment.max - assignment.min) * 100}%`,
          }}
        />
        <div
          className="absolute w-2 h-4 bg-blue-400 rounded -top-1"
          style={{ left: `${assignment.min * 100}%` }}
          data-testid={`min-handle-${paramKey}`}
        />
        <div
          className="absolute w-2 h-4 bg-blue-400 rounded -top-1"
          style={{ left: `${assignment.max * 100}%` }}
          data-testid={`max-handle-${paramKey}`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * ParameterEditorPane renders a side panel when a block is selected.
 * Shows schema-driven parameter controls (sliders, toggles, dropdowns)
 * with human-readable display values. Supports model swapping.
 */
export function ParameterEditorPane() {
  const selectedBlockId = useVisualizerStore((s) => s.selectedBlockId);
  const selectBlock = useVisualizerStore((s) => s.selectBlock);
  const setParameterValue = useVisualizerStore((s) => s.setParameterValue);
  const swapBlockModel = useVisualizerStore((s) => s.swapBlockModel);

  // Reactive subscriptions — trigger re-render when snapshot/block state changes
  const activeSnapshotIndex = useVisualizerStore((s) => s.activeSnapshotIndex);
  const snapshots = useVisualizerStore((s) => s.snapshots);
  const baseBlocks = useVisualizerStore((s) => s.baseBlocks);
  const controllerAssignments = useVisualizerStore((s) => s.controllerAssignments);
  void activeSnapshotIndex;
  void snapshots;
  void baseBlocks;

  const handleParamChange = useCallback(
    (paramKey: string, value: number | boolean) => {
      if (selectedBlockId) {
        setParameterValue(selectedBlockId, paramKey, value);
      }
    },
    [selectedBlockId, setParameterValue],
  );

  const handleModelSwap = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (selectedBlockId) {
        swapBlockModel(selectedBlockId, e.target.value);
      }
    },
    [selectedBlockId, swapBlockModel],
  );

  if (selectedBlockId === null) {
    return null;
  }

  // Get the effective block state (snapshot-aware)
  const state = useVisualizerStore.getState();
  const block = getEffectiveBlockState(state, selectedBlockId);

  if (!block) {
    return null;
  }

  // Get visible parameters (filtered and sorted)
  const visibleParams = getVisibleParameters(block.parameters);

  // Get model catalog for swap dropdown
  const modelCatalog = MODEL_CATALOGS_BY_TYPE[block.type];
  const modelEntries = modelCatalog ? Object.values(modelCatalog) : [];

  return (
    <div
      className="w-80 bg-gray-900 border-l border-gray-700 p-4 flex flex-col gap-4 overflow-y-auto"
      data-testid="parameter-editor-pane"
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">{block.modelName}</h2>
        <button
          onClick={() => selectBlock(null)}
          className="text-gray-400 hover:text-white"
          aria-label="Close parameter editor"
          data-testid="close-editor-btn"
        >
          X
        </button>
      </div>
      <span className="text-xs text-gray-400 uppercase">{block.type}</span>

      {/* Model Swap Dropdown */}
      {modelEntries.length > 0 && (
        <div data-testid="model-swap-section">
          <label className="text-xs text-gray-400 uppercase block mb-1">
            Swap Model
          </label>
          <select
            value={block.modelId}
            onChange={handleModelSwap}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1"
            aria-label="Swap model"
            data-testid="model-swap-dropdown"
          >
            {modelEntries.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Parameter List */}
      {(() => {
        // Evaluate dependency rules against block parameters
        const depState = evaluateDependencies(
          block.parameters as Record<string, number | boolean>,
        );

        // Filter visible params further by dependency visibility
        const filteredParams = visibleParams.filter(([paramKey]) => {
          const dep = depState[paramKey];
          if (dep && !dep.visible) return false;
          return true;
        });

        if (filteredParams.length === 0) {
          return (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              No editable parameters
            </div>
          );
        }

        return (
          <div className="flex flex-col gap-3" data-testid="parameter-list">
            {filteredParams.map(([paramKey, rawValue]) => {
              const schema = PARAMETER_SCHEMA[paramKey] ?? DEFAULT_SCHEMA;
              const paramDep = depState[paramKey] ?? {
                visible: true,
                enabled: true,
                dimmed: false,
              };

              // Check for controller assignment (EXP pedal)
              const ctrlAssignment = getControllerForParam(
                controllerAssignments,
                selectedBlockId!,
                paramKey,
              );

              // If assigned to expression pedal, render DualHandleSlider
              if (ctrlAssignment) {
                return (
                  <DualHandleSlider
                    key={paramKey}
                    paramKey={paramKey}
                    assignment={ctrlAssignment}
                    schema={schema}
                  />
                );
              }

              // Build wrapper classes for disabled/dimmed states
              const wrapperClasses = [
                !paramDep.enabled ? "opacity-50 pointer-events-none" : "",
                paramDep.dimmed ? "opacity-60" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const needsWrapper = wrapperClasses.length > 0;

              let control: React.ReactNode;

              if (schema.type === "boolean") {
                control = (
                  <ToggleControl
                    key={paramKey}
                    paramKey={paramKey}
                    value={rawValue as boolean}
                    onChange={(k, v) => handleParamChange(k, v)}
                  />
                );
              } else if (schema.type === "discrete") {
                control = (
                  <DropdownControl
                    key={paramKey}
                    paramKey={paramKey}
                    rawValue={rawValue as number}
                    schema={schema}
                    onChange={(k, v) => handleParamChange(k, v)}
                  />
                );
              } else {
                control = (
                  <SliderControl
                    key={paramKey}
                    paramKey={paramKey}
                    rawValue={rawValue as number}
                    schema={schema}
                    onChange={(k, v) => handleParamChange(k, v)}
                  />
                );
              }

              if (needsWrapper) {
                return (
                  <div
                    key={paramKey}
                    className={wrapperClasses}
                    data-testid={`param-wrapper-${paramKey}`}
                  >
                    {control}
                  </div>
                );
              }

              return control;
            })}
          </div>
        );
      })()}
    </div>
  );
}
