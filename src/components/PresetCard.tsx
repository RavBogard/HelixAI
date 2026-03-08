"use client";

import ReactMarkdown from "react-markdown";

// Signal chain block data from PresetSpec
export interface VizBlock {
  type: string;
  modelId: string;
  modelName: string;
  dsp: number;
  enabled: boolean;
}

// Snapshot data from PresetSpec
export interface VizSnapshot {
  name: string;
  ledColor: number;
  description: string;
}

// LED color number → CSS color mapping (matches Helix hardware colors)
const LED_CSS: Record<number, string> = {
  1: "#ef4444",   // Red
  2: "#f97316",   // Orange
  3: "#eab308",   // Yellow
  4: "#22c55e",   // Green
  5: "#06b6d4",   // Turquoise
  6: "#3b82f6",   // Blue
  7: "#a855f7",   // Purple
  8: "#e5e7eb",   // White
};

// Block type -> display label (COHERE-05: dynamics handled by getBlockLabel)
const BLOCK_LABEL: Record<string, string> = {
  distortion: "Drive",
  amp: "Amp",
  cab: "Cab",
  eq: "EQ",
  volume: "Gain",
  modulation: "Mod",
  delay: "Delay",
  reverb: "Reverb",
  wah: "Wah",
  pitch: "Pitch",
  send_return: "FX Loop",
};

// COHERE-05: Context-aware block label — distinguishes compressor from gate
function getBlockLabel(block: { type: string; modelId: string }): string {
  if (block.type === "dynamics") {
    // Compressor IDs: HD2_Compressor* (except HD2_CompressorAutoSwell which is a swell effect)
    if (block.modelId.startsWith("HD2_Compressor") && !block.modelId.includes("AutoSwell")) {
      return "Comp";
    }
    // Gate IDs: HD2_Gate*
    if (block.modelId.startsWith("HD2_Gate")) {
      return "Gate";
    }
    // Autoswell and unknown dynamics
    return "Dynamics";
  }
  return BLOCK_LABEL[block.type] || block.type;
}

function SignalChainViz({ blocks }: { blocks: VizBlock[] }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-center gap-1.5 min-w-0">
        {blocks.map((block, i) => (
          <div key={i} className="flex items-center gap-1.5 flex-shrink-0">
            <div className="hlx-signal-block" data-disabled={!block.enabled ? "true" : undefined}>
              <span className="hlx-signal-block-label">
                {getBlockLabel(block)}
              </span>
              <span className="hlx-signal-block-name">
                {block.modelName}
              </span>
              <span className="hlx-signal-led" />
            </div>
            {i < blocks.length - 1 && (
              <svg width="12" height="12" viewBox="0 0 12 12" className="flex-shrink-0 text-[var(--hlx-text-muted)]">
                <path d="M2 6h8M7 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToneDescriptionCard({
  ampName,
  cabName,
  effects,
  snapshots,
  guitarNotes,
}: {
  ampName: string;
  cabName: string;
  effects: VizBlock[];
  snapshots: VizSnapshot[];
  guitarNotes?: string;
}) {
  return (
    <div className="space-y-4">
      {/* Amp → Cab pair */}
      <div className="flex items-center gap-2 text-[0.8125rem]">
        <span className="hlx-section-label" style={{ marginBottom: 0 }}>Signal</span>
        <span className="text-[var(--hlx-text)]">{ampName}</span>
        <span className="text-[var(--hlx-text-muted)]">&rarr;</span>
        <span className="text-[var(--hlx-text)]">{cabName}</span>
      </div>

      {/* Effects list */}
      {effects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {effects.map((fx, i) => (
            <span key={i} className="hlx-effect-tag">
              <span className="hlx-effect-tag-label">
                {getBlockLabel(fx)}
              </span>
              {fx.modelName}
            </span>
          ))}
        </div>
      )}

      {/* Snapshots */}
      <div className="flex flex-wrap gap-2">
        {snapshots.map((snap, i) => (
          <span key={i} className="hlx-snapshot-badge">
            <span
              className="w-[6px] h-[6px] rounded-full flex-shrink-0"
              style={{
                background: LED_CSS[snap.ledColor] || LED_CSS[7],
                boxShadow: `0 0 6px ${LED_CSS[snap.ledColor] || LED_CSS[7]}40`,
              }}
            />
            {snap.name}
          </span>
        ))}
      </div>

      {/* Guitar notes */}
      {guitarNotes && (
        <div className="text-[0.8125rem] text-[var(--hlx-text-sub)] leading-relaxed border-l-2 border-[var(--hlx-border-warm)] pl-3 italic">
          {guitarNotes}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresetCard — displays the generated preset result
// ---------------------------------------------------------------------------

export interface PresetCardData {
  preset: Record<string, unknown>;
  summary: string;
  spec: Record<string, unknown> & { name?: string };
  toneIntent: Record<string, unknown>;
  device: string;
  fileExtension?: string;
  substitutionMap?: SubstitutionEntryDisplay[];
}

export interface SubstitutionEntryDisplay {
  physicalPedal: string;
  helixModel: string;
  helixModelDisplayName: string;
  substitutionReason: string;
  confidence: "direct" | "close" | "approximate";
  parameterMapping?: Record<string, number>;
}

interface PresetCardProps {
  data: PresetCardData;
  onDownload: () => void;
}

export function PresetCard({ data, onDownload }: PresetCardProps) {
  const spec = data.spec as Record<string, unknown>;
  const chain = (spec.signalChain || []) as VizBlock[];
  const snaps = (spec.snapshots || []) as VizSnapshot[];
  const intent = data.toneIntent as Record<string, unknown>;
  const ampBlock = chain.find((b) => b.type === "amp");
  const cabBlock = chain.find((b) => b.type === "cab");
  const effectBlocks = chain.filter(
    (b) => !["amp", "cab", "eq", "volume", "dynamics"].includes(b.type)
  );

  return (
    <div className="hlx-preset-card space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="hlx-led hlx-led-warm" />
          <h3 className="hlx-font-display text-lg font-semibold text-[var(--hlx-text)]">
            {data.spec?.name || "HelixTones Preset"}
          </h3>
          {/* Device badge — tells user which device this preset targets */}
          <span
            className="hlx-confidence-badge"
            data-level="direct"
            style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}
          >
            {data.device === "helix_lt" ? "LT"
              : data.device === "helix_floor" ? "FLOOR"
              : data.device === "helix_stadium" ? "STADIUM"
              : data.device === "helix_stomp" ? "STOMP"
              : data.device === "helix_stomp_xl" ? "STOMP XL"
              : data.device === "helix_native" ? "NATIVE"
              : data.device === "helix_rack" ? "RACK"
              : "POD GO"}
          </span>
        </div>
        <button onClick={onDownload} aria-label="Download preset" className="hlx-download" style={{ minHeight: "44px" }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download {data.fileExtension || ".hlx"}
        </button>
      </div>

      <div className="hlx-rack" />

      {/* Signal Chain Visualization (FXUI-01) */}
      {chain.length > 0 && (
        <div>
          <p className="hlx-section-label">Signal Chain</p>
          <SignalChainViz blocks={chain} />
        </div>
      )}

      <div className="hlx-rack" />

      {/* Tone Description Card (FXUI-02) */}
      <ToneDescriptionCard
        ampName={ampBlock?.modelName || (intent.ampName as string) || "Unknown Amp"}
        cabName={cabBlock?.modelName || (intent.cabName as string) || "Unknown Cab"}
        effects={effectBlocks}
        snapshots={snaps}
        guitarNotes={(spec.guitarNotes as string) || (intent.guitarNotes as string) || undefined}
      />

      <div className="hlx-rack" />

      {/* Summary */}
      <div className="text-[0.8125rem] text-[var(--hlx-text-sub)] leading-relaxed message-content">
        <ReactMarkdown>{data.summary || ""}</ReactMarkdown>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubstitutionCard (Phase 21)
// Renders the list of physical pedal → Helix model substitutions produced by
// /api/map. Shown in the upload panel after vision extraction, before Generate.
// ---------------------------------------------------------------------------

export function SubstitutionCard({ entries }: { entries: SubstitutionEntryDisplay[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="hlx-section-label">Helix Substitutions</p>
      <div className="space-y-2">
        {entries.map((entry, i) => {
          // Safety guard: never render an HD2_ internal ID in the UI.
          // helixModelDisplayName is always human-readable per rig-intent.ts,
          // but this guard protects against future regressions.
          const displayName = entry.helixModelDisplayName.startsWith("HD2_")
            ? entry.helixModel.replace(/^HD2_/, "").replace(/_/g, " ")
            : entry.helixModelDisplayName;

          const confidenceClass = entry.confidence === "direct"
            ? "hlx-confidence-direct"
            : entry.confidence === "close"
            ? "hlx-confidence-close"
            : "hlx-confidence-approximate";

          return (
            <div key={i} className={`hlx-substitution-row ${confidenceClass}`}>
              {/* Header row: Physical → Helix name + confidence badge */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[0.8125rem] text-[var(--hlx-text)] font-medium truncate">
                    {entry.physicalPedal}
                  </span>
                  <svg
                    className="w-3 h-3 text-[var(--hlx-text-muted)] flex-shrink-0"
                    fill="none"
                    viewBox="0 0 12 12"
                  >
                    <path
                      d="M2 6h8M7 3l3 3-3 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span
                    className={`text-[0.8125rem] font-semibold flex-shrink-0 ${
                      entry.confidence === "direct"
                        ? "text-[var(--hlx-amber)]"
                        : entry.confidence === "close"
                        ? "text-yellow-400"
                        : "text-orange-400"
                    }`}
                  >
                    {displayName}
                  </span>
                </div>

                <span className="hlx-confidence-badge" data-level={entry.confidence}>
                  {entry.confidence === "direct" ? "Exact match" : entry.confidence === "close" ? "Best match" : "Approximate"}
                </span>
              </div>

              {/* Substitution reason */}
              <p className="text-[11px] text-[var(--hlx-text-muted)] mt-1.5 leading-relaxed">
                {entry.substitutionReason}
              </p>

              {/* Escape hatch panel — only for approximate (unknown pedal) entries */}
              {entry.confidence === "approximate" && (
                <div className="mt-2 rounded-md bg-orange-950/20 border border-orange-900/20 px-2.5 py-2">
                  <p className="text-[11px] text-orange-300/90 leading-relaxed">
                    We don&apos;t have <strong>{entry.physicalPedal}</strong> in our
                    database. You can describe its sound instead, or we&apos;ll treat it
                    as an overdrive-type pedal.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
