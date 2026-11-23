import type { ImageStats, RgbaImage } from "@negarlab/ip";
import { byteHistogram, lumaHistogram, planeStats, rgbaToLuma } from "@negarlab/ip";
import * as Comlink from "comlink";

export interface ImageAnalysis {
  stats: ImageStats;
  lumaHistogram: Uint32Array;
  channels: [Uint32Array, Uint32Array, Uint32Array];
}

export interface WorkerApi {
  analyze(image: RgbaImage): ImageAnalysis;
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
};

Comlink.expose(api);
