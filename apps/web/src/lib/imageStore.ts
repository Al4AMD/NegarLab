import type { RgbaImage } from "@negarlab/ip";
import { create } from "zustand";
import { decodeImageBlob } from "./decodeImage";

export const DEMO_IMAGES = [
  "zone-plate",
  "gray-ramp",
  "resolution-wedge",
  "color-checker",
] as const;

export type DemoName = (typeof DEMO_IMAGES)[number];

interface ImageState {
  image: RgbaImage | null;
  preview: RgbaImage | null;
  label: string | null;
  loading: boolean;
  errorKey: string | null;
  selected: { x: number; y: number } | null;
  selectPixel: (x: number, y: number) => void;
  setPreview: (image: RgbaImage | null) => void;
  loadDemo: (name: DemoName) => Promise<void>;
  loadFile: (file: File) => Promise<void>;
  clear: () => void;
}

async function ingestFile(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/v1/ingest", { method: "POST", body });
  if (!response.ok) throw new Error("ingest_failed");
  const summary = (await response.json()) as { image_id: string };
  return summary.image_id;
}

export const useImageStore = create<ImageState>((set) => ({
  image: null,
  preview: null,
  label: null,
  loading: false,
  errorKey: null,
  selected: null,

  selectPixel: (x, y) => set({ selected: { x, y } }),
  setPreview: (preview) => set(preview ? { preview } : { preview: null, selected: null }),

  loadDemo: async (name) => {
    set({ loading: true, errorKey: null });
    try {
      const response = await fetch(`/demo/${name}.png`);
      if (!response.ok) throw new Error("demo_fetch_failed");
      const image = await decodeImageBlob(await response.blob());
      set({ image, preview: null, label: `${name}.png`, loading: false, selected: null });
    } catch {
      set({ loading: false, errorKey: "stage.errors.load" });
    }
  },

  loadFile: async (file) => {
    set({ loading: true, errorKey: null });
    try {
      const imageId = await ingestFile(file);
      const response = await fetch(`/api/v1/images/${imageId}`);
      if (!response.ok) throw new Error("image_fetch_failed");
      const image = await decodeImageBlob(await response.blob());
      set({ image, preview: null, label: file.name, loading: false, selected: null });
    } catch {
      set({ loading: false, errorKey: "stage.errors.upload" });
    }
  },

  clear: () =>
    set({
      image: null,
      preview: null,
      label: null,
      loading: false,
      errorKey: null,
      selected: null,
    }),
}));
