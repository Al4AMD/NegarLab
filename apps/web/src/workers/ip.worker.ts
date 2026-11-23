import type { ImageStats, RgbaImage } from "@negarlab/ip";
import {
  byteHistogram,
  clahe,
  contrastStretch,
  equalize,
  gammaCorrect,
  logTransform,
  lumaHistogram,
  negative,
  otsuThreshold,
  planeStats,
  quantizeBits,
  resizeNearest,
  rgbaToLuma,
  threshold,
} from "@negarlab/ip";
import * as Comlink from "comlink";

export interface ImageAnalysis {
  stats: ImageStats;
  lumaHistogram: Uint32Array;
  channels: [Uint32Array, Uint32Array, Uint32Array];
}

export type OpRequest =
  | { kind: "negative" }
  | { kind: "log" }
  | { kind: "gamma"; gamma: number }
  | { kind: "equalize" }
  | { kind: "stretch"; low: number; high: number }
  | { kind: "otsu" }
  | { kind: "threshold"; cutoff: number }
  | { kind: "clahe"; tiles: number; clipLimit: number }
  | { kind: "quantize"; bits: number }
  | { kind: "resize"; factor: number };

export interface WorkerApi {
  analyze(image: RgbaImage): ImageAnalysis;
  applyOps(image: RgbaImage, ops: OpRequest[]): RgbaImage;
}

function applyOp(image: RgbaImage, op: OpRequest): RgbaImage {
  switch (op.kind) {
    case "negative":
      return negative(image);
    case "log":
      return logTransform(image);
    case "gamma":
      return gammaCorrect(image, op.gamma);
    case "equalize":
      return equalize(image);
    case "stretch":
      return contrastStretch(image, op.low, op.high);
    case "otsu":
      return threshold(image, otsuThreshold(rgbaToLuma(image)));
    case "threshold":
      return threshold(image, op.cutoff);
    case "clahe":
      return clahe(image, { tiles: op.tiles, clipLimit: op.clipLimit });
    case "quantize":
      return quantizeBits(image, op.bits);
    case "resize": {
      const width = Math.max(1, Math.round(image.width / op.factor));
      const height = Math.max(1, Math.round(image.height / op.factor));
      return resizeNearest(image, width, height);
    }
  }
}

const api: WorkerApi = {
  analyze(image) {
    return {
      stats: planeStats(rgbaToLuma(image)),
      lumaHistogram: lumaHistogram(image),
      channels: [
        byteHistogram(image.data, 0),
        byteHistogram(image.data, 1),
        byteHistogram(image.data, 2),
      ],
    };
  },
  applyOps(image, ops) {
    return ops.reduce(applyOp, image);
  },
};

Comlink.expose(api);
