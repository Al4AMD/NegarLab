import { create } from "zustand";

export interface SourceImage {
  id: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  downscaled: boolean;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function cacheKey(inputId: string, params: Record<string, unknown>): string {
  return `${inputId}:${stableStringify(params)}`;
}

interface SessionState {
  source: SourceImage | null;
  setSource: (source: SourceImage | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  source: null,
  setSource: (source) => set({ source }),
  clear: () => set({ source: null }),
}));
