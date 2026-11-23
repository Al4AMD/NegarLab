import type { ImageStats, RgbaImage } from "@negarlab/ip";
import { planeStats, rgbaToLuma } from "@negarlab/ip";
import * as Comlink from "comlink";

export interface WorkerApi {
  lumaAndStats(image: RgbaImage): ImageStats;
}

const api: WorkerApi = {
  lumaAndStats(image) {
    return planeStats(rgbaToLuma(image));
  },
};

Comlink.expose(api);
