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
  "@mic": number;
  Distance?: number;
  Level?: number;
  LowCut?: number;
  HighCut?: number;
  EarlyReflections?: number;
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

// --- Preset specification types (what the AI generates) ---

export interface PresetSpec {
  name: string;
  description: string;
  tempo: number;
  guitarNotes?: string;
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
  parameters: Record<string, number>;
}

export interface SnapshotSpec {
  name: string;
  description: string;
  ledColor: number;
  blockStates: Record<string, boolean>; // blockKey -> enabled
  parameterOverrides: Record<string, Record<string, number>>; // blockKey -> paramName -> value
}
