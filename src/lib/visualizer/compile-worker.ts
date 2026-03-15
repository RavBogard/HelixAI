import { buildHlxFile } from "../helix/preset-builder";
import type { PresetSpec, DeviceTarget } from "../helix/types";

// Message sent from the React UI thread to the worker
export interface CompilationRequest {
  id: string; // unique request ID
  presetName: string;
  presetData: PresetSpec;
  deviceTarget: DeviceTarget;
}

// Message sent from the worker back to the React UI thread
export interface CompilationResponse {
  id: string;
  success: boolean;
  fileBlob?: Blob;      // The completed binary/JSON file
  fileName?: string;    // e.g., "My Preset.hlx"
  error?: string;
}

// The Web Worker event listener
self.addEventListener("message", async (event: MessageEvent<CompilationRequest>) => {
  const { id, presetName, presetData, deviceTarget } = event.data;

  try {
    // 1. Run the shared builder logic. Since Phase 14 removed all Node.js fs dependencies,
    // this pure-JS payload is cross-compatible.
    const hlxJson = buildHlxFile(presetData, deviceTarget);
    
    // 2. Determine file extension
    const extension = deviceTarget === "pod_go" ? ".pgp" : ".hlx";
    const fileName = `${presetName.replace(/[^a-zA-Z0-9 -]/g, "")}${extension}`;

    // 3. Serialize to JSON with 4-space indentation to match Line 6 formatting exactly
    const jsonString = JSON.stringify(hlxJson, null, 4);
    
    // 4. Create an in-memory browser Blob representing the file
    const fileBlob = new Blob([jsonString], { type: "application/json" });

    // 5. Send back to the main thread
    self.postMessage({
      id,
      success: true,
      fileBlob,
      fileName,
    } as CompilationResponse);

  } catch (err: unknown) {
    self.postMessage({
      id,
      success: false,
      error: err instanceof Error ? err.message : "Unknown compilation error",
    } as CompilationResponse);
  }
});
