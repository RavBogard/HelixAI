// Types representing the .hlx preset file format for Line6 Helix LT

export interface HlxFile {
  version: number;
  data: {
    device: number;
    device_version: number;
    meta: HlxMeta;
    tone: HlxTone;
  };
  meta: {
    original: number;
    pbn: number;
    premium: number;
  };
  schema: "L6Preset";
}

export interface HlxMeta {
  name: string;
  application: string;
  build_sha: string;
  modifieddate: number;
  appversion: number;
}

export interface HlxTone {
  dsp0: HlxDsp;
  dsp1: HlxDsp;
  snapshot0: HlxSnapshot;
  snapshot1: HlxSnapshot;
  snapshot2: HlxSnapshot;
  snapshot3: HlxSnapshot;
  snapshot4: HlxSnapshot;
  snapshot5: HlxSnapshot;
  snapshot6: HlxSnapshot;
  snapshot7: HlxSnapshot;
  controller: HlxControllerSection;
  footswitch: Record<string, unknown>;
  global: HlxGlobal;
}

export interface HlxDsp {
  inputA: HlxInput;
  inputB?: HlxInput;
  outputA: HlxOutput;
  outputB?: HlxOutput;
  split?: HlxSplit;
  join?: HlxJoin;
  [key: string]: HlxBlock | HlxCab | HlxInput | HlxOutput | HlxSplit | HlxJoin | undefined;
}

export interface HlxInput {
  "@input": number;
  "@model": string;
  noiseGate?: boolean;
  decay?: number;
  threshold?: number;
}

export interface HlxOutput {
  "@model": string;
  "@output": number;
  pan: number;
  gain: number;
}

export interface HlxSplit {
  "@model": string;
  "@enabled": boolean;
  "@position": number;
  RouteTo?: number;
  bypass?: boolean;
}

export interface HlxJoin {
  "@model": string;
  "@position": number;
  "A Level"?: number;
  "B Level"?: number;
  "A Pan"?: number;
  "B Pan"?: number;
}

export interface HlxBlock {
  "@model": string;
  "@position": number;
  "@enabled": boolean;
  "@path": number;
  "@type": number;
  "@stereo": boolean;
  "@no_snapshot_bypass"?: boolean;
  "@bypassvolume"?: number;
  "@cab"?: string;
  "@trails"?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export interface HlxCab {
  "@model": string;
  "@enabled": boolean;
  "@mic": number;          // integer index 0-15 (0=SM57, 7=Ribbon 121, 11=U67 Condenser)
  Distance?: number;       // normalized 0-1 (optional)
  Level?: number;          // normalized 0-1 (optional)
  LowCut: number;          // REQUIRED — raw Hz (e.g., 80.0). NOT normalized 0-1. Min 19.9, typical 80-100.
  HighCut: number;         // REQUIRED — raw Hz (e.g., 8000.0). NOT normalized 0-1. Max 20100.0, typical 6500-8000.
  EarlyReflections?: number;
  Angle?: number;
  Position?: number;
}

export interface HlxSnapshot {
  "@name": string;
  "@tempo": number;
  "@valid": boolean;
  "@pedalstate": number;
  "@ledcolor": number;
  "@custom_name"?: boolean;
  blocks?: {
    dsp0?: Record<string, boolean>;
    dsp1?: Record<string, boolean>;
  };
  controllers?: {
    dsp0?: Record<string, Record<string, { "@fs_enabled": boolean; "@value": number }>>;
    dsp1?: Record<string, Record<string, { "@fs_enabled": boolean; "@value": number }>>;
  };
}

export interface HlxControllerSection {
  dsp0?: Record<string, Record<string, HlxControllerAssignment>>;
  dsp1?: Record<string, Record<string, HlxControllerAssignment>>;
}

export interface HlxControllerAssignment {
  "@min": number;
  "@max": number;
  "@controller": number; // 19 = Snapshot, 2 = EXP Pedal 2, 18 = MIDI CC
  "@snapshot_disable"?: boolean;
  "@cc"?: number;
}

export interface HlxGlobal {
  "@model": string;
  "@topology0": "A" | "AB" | "SABJ";
  "@topology1": "A" | "AB" | "SABJ";
  "@cursor_dsp": number;
  "@cursor_path": number;
  "@cursor_position": number;
  "@cursor_group": string;
  "@tempo": number;
  "@current_snapshot": number;
  "@pedalstate": number;
  "@guitarpad"?: number;
  "@guitarinputZ"?: number;
}

// Amp classification types — used by HelixModel extension in models.ts and param-engine.ts (Phase 2)
export type AmpCategory = "clean" | "crunch" | "high_gain";

export type TopologyTag =
  | "cathode_follower"   // EL84/EL34 cathode-follower: Vox AC30/AC15, Matchless DC-30
  | "plate_fed"          // 6L6/6V6/EL34 plate-driven: Fender, Marshall, Mesa
  | "solid_state"        // JC-120 (no tube power amp characteristics)
  | "not_applicable";    // for non-amp models (cabs, effects)

/** Amp manufacturer family — used for per-model parameter override grouping (AMP-01). */
export type AmpFamily =
  | "Fender"
  | "Marshall"
  | "Vox"
  | "Mesa"
  | "Matchless"
  | "Hiwatt"
  | "Soldano"
  | "Friedman"
  | "Diezel"
  | "Bogner"
  | "EVH"
  | "PRS"
  | "ENGL"
  | "Revv"
  | "Grammatico"
  | "Line6";

export type CabSize = "small" | "medium" | "large";

// Device target for .hlx / .pgp / .hsp file generation
export type DeviceTarget =
  | "helix_lt"
  | "helix_floor"
  | "helix_rack"
  | "pod_go"
  | "pod_go_xl"
  | "helix_stadium"
  | "helix_stadium_xl"
  | "helix_native"
  | "helix_stomp"
  | "helix_stomp_xl";

// Source: Phase 23 research and commit 3ba0768 (fix(phase-23): correct Helix Floor device ID)
// Regression: commit 68ad895 (docs: start milestone v2.0) incorrectly reset helix_floor to 2162692
export const DEVICE_IDS: Record<DeviceTarget, number> = {
  helix_lt: 2162692,        // 0x210004 — confirmed from real Helix LT .hlx exports (Phase 1, FNDN-03)
  helix_floor: 2162689,     // 0x210001 — confirmed from 15 real .hlx files spanning fw v1.02–v3.80, verified working on all OG Helix devices (Phase 59, 2026-03-05)
  helix_rack: 2162689,      // UNVERIFIED: assumed same as Floor — confirm from real Helix Rack .hlx export
  pod_go: 2162695,          // 0x210007 — confirmed from 18 real .pgp files (Phase 12)
  pod_go_xl: 2162695,       // PLACEHOLDER: Pod Go XL not yet a real product — uses pod_go ID
  helix_stadium: 2490368,   // Source: FluidSolo Stadium_Metal_Rhythm.hsp, meta.device_id, 2026-03-04 (Phase 31)
  helix_stadium_xl: 0,      // UNVERIFIED: real product (June 2025) but device ID not in corpus
  helix_native: 2162690,    // UNVERIFIED: estimated from Line 6 device ID sequence (0x210002)
  helix_stomp: 2162694,     // Confirmed from Swell_Delay.hlx (HX Stomp hardware export, 2026-03-04)
  helix_stomp_xl: 2162699,  // Confirmed from The_Kids_Are_D.hlx (HX Stomp XL hardware export, 2026-03-04)
} as const;

/** Returns true if the device target is a Helix (LT, Floor, or Rack) */
export function isHelix(device: DeviceTarget): boolean {
  return device === "helix_lt" || device === "helix_floor" || device === "helix_rack" || device === "helix_native";
}

/** Returns true if the device target is a Pod Go (any variant) */
export function isPodGo(device: DeviceTarget): boolean {
  return device === "pod_go" || device === "pod_go_xl";
}

/** Returns true if the device target is a Helix Stadium (any variant) */
export function isStadium(device: DeviceTarget): boolean {
  return device === "helix_stadium" || device === "helix_stadium_xl";
}

/** Returns true if the device target is any HX Stomp variant (Stomp or Stomp XL) */
export function isStomp(device: DeviceTarget): boolean {
  return device === "helix_stomp" || device === "helix_stomp_xl";
}

/** Returns true if the device supports Variax (VDI input). Helix Floor, LT, Rack, Stomp, Stomp XL all have VDI. Pod Go, Stadium, and Native (software) do not. */
export function isVariaxSupported(device: DeviceTarget): boolean {
  return (isHelix(device) && device !== "helix_native") || isStomp(device);
}

// ---------------------------------------------------------------------------
// Pod Go format constants
// Source: Direct inspection of 18 real .pgp files (firmware v1.00–v2.00)
// ---------------------------------------------------------------------------

/** Pod Go block @type values — completely different encoding from Helix */
export const BLOCK_TYPES_PODGO = {
  // Generic effects (distortion, dynamics, wah, volume, pitch, modulation, CabMicIr)
  GENERIC: 0,
  // Amp block
  AMP: 1,
  // Simple cab (HD2_Cab*)
  SIMPLE_CAB: 2,
  // Looper
  LOOPER: 4,
  // Delay, Reverb, FX Loop — all share @type=5
  DELAY: 5,
  REVERB: 5,
  FX_LOOP: 5,
  // Static EQ (HD2_EQ_STATIC_*)
  EQ_STATIC: 6,
} as const;

/** Pod Go I/O model constants */
export const POD_GO_IO = {
  INPUT_MODEL: "P34_AppDSPFlowInput",
  OUTPUT_MODEL: "P34_AppDSPFlowOutput",
  INPUT_KEY: "input",
  OUTPUT_KEY: "output",
} as const;

/** Pod Go snapshot controller ID (Helix uses 19, Pod Go uses 4) */
export const POD_GO_SNAPSHOT_CONTROLLER = 4;

/** Pod Go footswitch indices: FS A-F = indices 0-5 */
export const POD_GO_STOMP_FS_INDICES = [0, 1, 2, 3, 4, 5];

/** Pod Go maximum user-assignable effect blocks */
export const POD_GO_MAX_USER_EFFECTS = 4;

/** Pod Go total block count (fixed: wah+vol+amp+cab+eq+fxloop = 6, flexible: 4) */
export const POD_GO_TOTAL_BLOCKS = 10;

// --- Preset specification types (what the AI generates) ---

export interface PresetSpec {
  name: string;
  description: string;
  tempo: number;
  guitarNotes?: string;
  variaxModel?: string;
  signalChain: BlockSpec[];
  snapshots: SnapshotSpec[];
}

export interface BlockSpec {
  type: "amp" | "cab" | "distortion" | "delay" | "reverb" | "modulation" | "dynamics" | "eq" | "wah" | "pitch" | "volume" | "send_return";
  modelId: string;
  modelName: string;
  dsp: 0 | 1;
  position: number;
  path: number;
  enabled: boolean;
  stereo: boolean;
  trails?: boolean;
  parameters: Record<string, number | boolean>;
  intentRole?: "always_on" | "toggleable" | "ambient"; // From EffectIntent — used by snapshot engine for role-aware toggling
  slot?: string; // COHERE-03: Chain slot propagated from chain-rules. "boost" marks mandatory boost blocks for snapshot-engine disambiguation.
}

export interface SnapshotSpec {
  name: string;
  description: string;
  ledColor: number;
  blockStates: Record<string, boolean>; // blockKey -> enabled
  parameterOverrides: Record<string, Record<string, number | boolean>>; // blockKey -> paramName -> value
}
