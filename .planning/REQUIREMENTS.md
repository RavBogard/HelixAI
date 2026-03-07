# Requirements: HelixTones

**Defined:** 2026-03-07
**Core Value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive, signal-chain intelligent

## v7.0 Requirements

Requirements for Interactive Signal Chain Visualizer milestone. Each maps to roadmap phases.

### Signal Chain Visualization

- [ ] **VIS-01**: Dual-DSP devices (Helix Floor/LT/Rack/Stadium) render two horizontal block rows (DSP 0 and DSP 1) with correct per-DSP block population
- [ ] **VIS-02**: Single-DSP devices (Stomp/StompXL) render one horizontal block row with correct total block count
- [ ] **VIS-03**: Pod Go renders fixed architecture layout (Wah→Vol→FX1→Amp→Cab→EQ→FX2→FX3→FX4) with visually locked positions for non-flexible blocks
- [ ] **VIS-04**: Each block renders as color-coded tile with category icon per BLOCK_UI_REGISTRY — 14 block types mapped to distinct colorHex, iconName, and widthMode (amp=yellow/wide, delay=green/standard, reverb=orange, etc.)
- [ ] **VIS-05**: Bypassed blocks (from active snapshot's blockStates) render as visually dimmed/grayed to indicate they are inactive in the current snapshot
- [ ] **VIS-06**: Selected block highlights visually and opens the ParameterEditorPane side panel

### Drag and Drop

- [ ] **DND-01**: Blocks can be reordered within a DSP row via drag-and-drop using a robust DnD library (dnd-kit, hello-pangea/dnd, or framer-motion)
- [ ] **DND-02**: Blocks can be dragged between DSP 0 and DSP 1 on dual-DSP devices, validated by canMoveBlockToDsp() against maxBlocksPerDsp limits
- [ ] **DND-03**: Pod Go fixed blocks (amp, cab, wah, volume, eq) are locked in place — drag attempts are rejected with descriptive error messages
- [ ] **DND-04**: Adding a new block is prevented when device block limits are reached — canAddBlock() enforces maxBlocksTotal (single DSP) and maxBlocksPerDsp (dual DSP)
- [ ] **DND-05**: Pod Go user-effect slot limit (maxEffectsPerDsp) is enforced separately for the 4 flexible effect blocks
- [ ] **DND-06**: User can remove a block via an "X" button on the block tile to free up a slot
- [ ] **DND-07**: User can click an empty slot to open a model browser for adding a new effect to the chain

### Parameter Editing

- [ ] **PARAM-01**: Clicking a block opens the ParameterEditorPane side panel displaying all editable parameters for that block's model
- [ ] **PARAM-02**: UI parameter schema registry maps 151+ parameter keys to 7 control types — percentage (slider 0-100%), eq_gain (slider -12dB to +12dB), db_level (slider -60dB to +12dB), time_ms (slider 0-2000ms), hz_freq (slider 20-20000Hz), boolean (toggle), discrete (dropdown)
- [ ] **PARAM-03**: Slider controls display human-readable values using displayMultiplier and displayOffset transforms — raw 0.0-1.0 values are never shown to users
- [ ] **PARAM-04**: Parameter changes write to the active snapshot's parameterOverrides, NOT the baseBlock — preserving base state integrity for all 4 snapshots
- [ ] **PARAM-05**: User can swap a block's model (e.g., Scream 808 → Minotaur) — model swap resets parameters to deterministic defaults from Knowledge Layer while preserving block position and DSP assignment

### Snapshot System

- [ ] **SNAP-01**: UI displays 4 snapshot selector buttons (Snap 1–4); switching snapshots immediately applies that snapshot's parameterOverrides and blockStates to the visualization
- [ ] **SNAP-02**: Effective block state is computed as merge: baseBlock parameters + active snapshot's parameterOverrides — snapshot overrides always win
- [ ] **SNAP-03**: Bypass states from snapshots[activeIndex].blockStates toggle block enabled/disabled visual state — false means block is bypassed in that snapshot
- [ ] **SNAP-04**: Parameter edits made while a snapshot is active write ONLY to that snapshot's parameterOverrides — other snapshots remain unmodified

### API Integration

- [ ] **API-01**: /api/preview endpoint accepts userPrompt + deviceTarget and returns baseBlocks[] + snapshots[4] as VisualizerState — this replaces the current single-step generation flow with a two-step preview-then-download flow
- [ ] **API-02**: /api/download endpoint accepts modified frontend VisualizerState (baseBlocks + snapshots) and compiles it into the correct downloadable binary — .hlx for Helix, .pgp for Pod Go, .hsp for Stadium
- [ ] **API-03**: Preview hydration uses the deterministic Knowledge Layer pipeline (chain-rules → param-engine → snapshot-engine) — zero AI token cost for parameter resolution after initial ToneIntent generation
- [ ] **API-04**: Download request payload is diff-optimized via calculateStateDiff() — only chain reordering, model swaps, and snapshot data are transmitted

### Controller Assignments

- [ ] **CTRL-01**: UI displays expression pedal (EXP1/EXP2/EXP3) parameter assignments with min/max range bounds — showing which parameters are hardware-controlled
- [ ] **CTRL-02**: UI displays footswitch (FS1-FS12) bypass assignments with optional custom label and LED color indicator
- [ ] **CTRL-03**: Parameter sliders show dual [Min]/[Max] handles with controller badge (e.g., "EXP1") when a parameter is assigned to an expression pedal controller
- [ ] **CTRL-04**: Draggable block tiles show a small footswitch badge (e.g., "FS2") in the corner when the block has a bypass assignment

### Parameter Dependencies

- [ ] **DEP-01**: When Sync=ON, Time and Speed sliders are hidden and Interval dropdown is shown; when Sync=OFF, the reverse applies — reactive toggle on parameter change
- [ ] **DEP-02**: When Link=ON, Right parameter controls (RightTime, RightFeedback) are disabled/grayed — user cannot edit them independently
- [ ] **DEP-03**: When ModDepth=0, ModSpeed control is visually dimmed to indicate it has no audible effect — but remains visible and editable
- [ ] **DEP-04**: Parameter dependency rules (GLOBAL_PARAMETER_DEPENDENCIES) evaluate reactively as users change parameter values — no stale dependency state

### State Management & Diffing

- [ ] **STATE-01**: Zustand store manages VisualizerState with baseBlocks, snapshots[4], activeSnapshotIndex, selectedBlockId, and all mutation actions (setParameterValue, moveBlock, swapBlockModel, hydrate)
- [ ] **STATE-02**: Computed selectors derive effective block state (getEffectiveBlockState) and DSP-grouped blocks (getBlocksByDsp) without duplicating data in the store
- [ ] **STATE-03**: calculateStateDiff() detects chain reordering (position/DSP/path changes) and model swaps (same blockId, different modelId) for download optimization
- [ ] **STATE-04**: Hydrate action replaces entire store state when /api/preview returns — clean state reset with no stale data from previous generation

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### AI Re-prompting

- **REPROMPT-F01**: When user swaps an amp model, AI re-evaluates cab pairing and suggests a matching cabinet
- **REPROMPT-F02**: When user removes an effect, AI suggests alternative signal chain configurations

### Advanced Editing

- **EDIT-F01**: User can copy parameter overrides from one snapshot to another
- **EDIT-F02**: User can revert a single block to its AI-generated defaults without resetting the whole chain
- **EDIT-F03**: Undo/redo stack for all visualizer editing actions

### Extended Controller Editing

- **CTRL-F01**: User can interactively reassign expression pedal and footswitch assignments from within the visualizer
- **CTRL-F02**: User can set custom min/max bounds for controller-assigned parameters via drag handles

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time audio preview | Requires Web Audio API or server-side amp sim — orders of magnitude more complex |
| AI re-prompting for cab/effect suggestions | Deferred to avoid token cost; deterministic Knowledge Layer covers v7.0 |
| Effect combination logic in visualizer | v6.0 combination rules run server-side during generation; visualizer accepts the result |
| Cost-aware Haiku/Sonnet routing | Deferred from v4.0/v6.0; not related to visualizer scope |
| Controller assignment editing (reassign FS/EXP) | v7.0 displays assignments read-only; interactive editing deferred |
| Dual-amp split/join path visualization | Complex routing topology; v7.0 treats dual-amp as two blocks on separate DSP rows |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIS-01 | Phase 78 | Pending |
| VIS-02 | Phase 78 | Pending |
| VIS-03 | Phase 78 | Pending |
| VIS-04 | Phase 78 | Pending |
| VIS-05 | Phase 78 | Pending |
| VIS-06 | Phase 78 | Pending |
| DND-01 | Phase 79 | Pending |
| DND-02 | Phase 79 | Pending |
| DND-03 | Phase 79 | Pending |
| DND-04 | Phase 79 | Pending |
| DND-05 | Phase 79 | Pending |
| DND-06 | Phase 79 | Pending |
| DND-07 | Phase 79 | Pending |
| PARAM-01 | Phase 80 | Pending |
| PARAM-02 | Phase 80 | Pending |
| PARAM-03 | Phase 80 | Pending |
| PARAM-04 | Phase 81 | Pending |
| PARAM-05 | Phase 80 | Pending |
| SNAP-01 | Phase 81 | Pending |
| SNAP-02 | Phase 81 | Pending |
| SNAP-03 | Phase 81 | Pending |
| SNAP-04 | Phase 81 | Pending |
| API-01 | Phase 77 | Pending |
| API-02 | Phase 83 | Pending |
| API-03 | Phase 77 | Pending |
| API-04 | Phase 83 | Pending |
| CTRL-01 | Phase 82 | Pending |
| CTRL-02 | Phase 82 | Pending |
| CTRL-03 | Phase 82 | Pending |
| CTRL-04 | Phase 82 | Pending |
| DEP-01 | Phase 82 | Pending |
| DEP-02 | Phase 82 | Pending |
| DEP-03 | Phase 82 | Pending |
| DEP-04 | Phase 82 | Pending |
| STATE-01 | Phase 77 | Pending |
| STATE-02 | Phase 77 | Pending |
| STATE-03 | Phase 83 | Pending |
| STATE-04 | Phase 77 | Pending |

**Coverage:**
- v7.0 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-06 after roadmap creation — all 38 requirements mapped to phases 77-83*
