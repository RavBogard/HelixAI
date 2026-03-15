import { useState, useCallback, useEffect, useRef } from "react";
import type { PresetSpec, DeviceTarget } from "../helix/types";
import type { CompilationRequest, CompilationResponse } from "./compile-worker";

interface CompilationResult {
  fileUrl: string | null;
  fileName: string | null;
  isCompiling: boolean;
  error: string | null;
}

export function useCompilerWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<CompilationResult>({
    fileUrl: null,
    fileName: null,
    isCompiling: false,
    error: null,
  });

  // Keep track of pending promises matched to specific correlation IDs
  const pendingRequests = useRef<
    Record<
      string,
      {
        resolve: (url: string) => void;
        reject: (reason: string) => void;
      }
    >
  >({});

  // Initialize the worker once on mount
  useEffect(() => {
    // Next.js (Webpack) specific syntax for referencing Web Workers natively
    workerRef.current = new Worker(new URL("./compile-worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (event: MessageEvent<CompilationResponse>) => {
      const { id, success, fileBlob, fileName, error } = event.data;
      
      if (pendingRequests.current[id]) {
        if (success && fileBlob && fileName) {
          // Resolve the promise via Object URL for downloading
          const url = URL.createObjectURL(fileBlob);
          setState({ fileUrl: url, fileName, isCompiling: false, error: null });
          pendingRequests.current[id].resolve(url);
        } else {
          // Reject the promise
          setState((prev) => ({ ...prev, isCompiling: false, error: error ?? "Worker failed" }));
          pendingRequests.current[id].reject(error ?? "Worker failed");
        }
        delete pendingRequests.current[id];
      }
    };

    return () => {
      // Cleanup worker and hanging URLs on unmount
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      setState((s) => {
        if (s.fileUrl) URL.revokeObjectURL(s.fileUrl);
        return s;
      });
    };
  }, []);

  const compilePreset = useCallback(
    async (presetData: PresetSpec, deviceTarget: DeviceTarget, presetName: string): Promise<string> => {
      if (!workerRef.current) {
        throw new Error("Worker not initialized context");
      }

      const id = Math.random().toString(36).substring(2, 9);
      
      setState((prev) => {
        if (prev.fileUrl) {
           URL.revokeObjectURL(prev.fileUrl);
        }
        return {
          fileUrl: null,
          fileName: null,
          isCompiling: true,
          error: null,
        };
      });

      return new Promise<string>((resolve, reject) => {
        pendingRequests.current[id] = { resolve, reject };

        const message: CompilationRequest = {
          id,
          presetName,
          presetData,
          deviceTarget,
        };
        
        // Deep clone presetData structuredClone ensures we aren't passing proxy/reactive references 
        // to the worker thread which could throw DOMException errors.
        workerRef.current!.postMessage(structuredClone(message));
      });
    },
    []
  );

  return { compilePreset, ...state };
}
