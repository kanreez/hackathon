import { useSyncExternalStore } from "react";
import { PickedImage } from "../utils/media";
import { ReportResponse, Scope } from "../types/triage";

// Tiny in-memory store that carries one report through Capture -> Processing -> Result
type Flow = { photo: PickedImage | null; scope: Scope; note: string; result: ReportResponse | null };

let state: Flow = { photo: null, scope: "own", note: "", result: null };
const listeners = new Set<() => void>();

export function setFlow(patch: Partial<Flow>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function resetFlow() {
  setFlow({ photo: null, note: "", result: null });
}

export function useFlow() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state
  );
}
