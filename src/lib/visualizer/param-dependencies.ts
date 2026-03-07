// param-dependencies.ts — Global parameter dependency rules and evaluator.
// Phase 82-01: Pure function that determines parameter visibility, enabled,
// and dimmed states based on control parameter values.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParamVisibility {
  visible: boolean; // false = hidden from UI entirely
  enabled: boolean; // false = grayed out, not editable
  dimmed: boolean; // true = visually subdued but still editable
}

export type DependencyRule = {
  /** The "controller" parameter that triggers this rule */
  controlParam: string;
  /** The condition: when controlParam's value matches this, the rule fires */
  condition: (value: number | boolean) => boolean;
  /** Parameters affected when the condition is TRUE */
  targets: {
    paramKey: string;
    effect: Partial<ParamVisibility>;
  }[];
};

// ---------------------------------------------------------------------------
// Global dependency rules
// ---------------------------------------------------------------------------

export const GLOBAL_PARAMETER_DEPENDENCIES: DependencyRule[] = [
  // DEP-01: Sync -> Time/Speed/Interval
  {
    controlParam: "Sync",
    condition: (v) => v === true || v === 1, // Sync=ON
    targets: [
      { paramKey: "Time", effect: { visible: false } },
      { paramKey: "Speed", effect: { visible: false } },
      { paramKey: "Left Time", effect: { visible: false } },
      { paramKey: "Right Time", effect: { visible: false } },
      { paramKey: "Interval", effect: { visible: true } },
    ],
  },
  {
    controlParam: "Sync",
    condition: (v) => v === false || v === 0, // Sync=OFF
    targets: [
      { paramKey: "Time", effect: { visible: true } },
      { paramKey: "Speed", effect: { visible: true } },
      { paramKey: "Left Time", effect: { visible: true } },
      { paramKey: "Right Time", effect: { visible: true } },
      { paramKey: "Interval", effect: { visible: false } },
    ],
  },
  // DEP-02: Link -> Right params
  {
    controlParam: "Link",
    condition: (v) => v === true || v === 1, // Link=ON
    targets: [
      { paramKey: "Right Time", effect: { enabled: false } },
      { paramKey: "Right Feedback", effect: { enabled: false } },
      { paramKey: "RightTime", effect: { enabled: false } },
      { paramKey: "RightFeedback", effect: { enabled: false } },
    ],
  },
  // DEP-03: ModDepth -> ModSpeed
  {
    controlParam: "ModDepth",
    condition: (v) => v === 0, // ModDepth=0
    targets: [{ paramKey: "ModSpeed", effect: { dimmed: true } }],
  },
];

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

const DEFAULT_VISIBILITY: ParamVisibility = {
  visible: true,
  enabled: true,
  dimmed: false,
};

/**
 * Evaluate all dependency rules against the given parameters and return a
 * visibility map covering ALL parameter keys in the input.
 *
 * Parameters not affected by any rule get the default state
 * `{visible: true, enabled: true, dimmed: false}`.
 *
 * Multiple rules can fire simultaneously. Effects are merged (last-write-wins
 * per property within a single ParamVisibility).
 */
export function evaluateDependencies(
  parameters: Record<string, number | boolean>,
): Record<string, ParamVisibility> {
  // Start with defaults for every parameter in the input
  const result: Record<string, ParamVisibility> = {};
  for (const paramKey of Object.keys(parameters)) {
    result[paramKey] = { ...DEFAULT_VISIBILITY };
  }

  // Evaluate each rule
  for (const rule of GLOBAL_PARAMETER_DEPENDENCIES) {
    const controlValue = parameters[rule.controlParam];
    if (controlValue === undefined) continue; // Control param not present

    if (!rule.condition(controlValue)) continue; // Condition not met

    // Apply effects to target parameters
    for (const target of rule.targets) {
      // Only apply if the target parameter exists in the input OR
      // if the effect is being set by a rule (create entry if needed)
      if (result[target.paramKey] === undefined) {
        // Target param might not be in the input but still needs tracking
        // if it exists elsewhere — only create if it's in parameters
        if (parameters[target.paramKey] === undefined) continue;
      }

      if (!result[target.paramKey]) {
        result[target.paramKey] = { ...DEFAULT_VISIBILITY };
      }

      // Merge effect properties
      Object.assign(result[target.paramKey], target.effect);
    }
  }

  return result;
}
