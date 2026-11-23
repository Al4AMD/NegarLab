export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface Plane {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;
}

export interface ImageStats {
  readonly mean: number;
  readonly variance: number;
  readonly entropyBits: number;
}

export interface RgbPlanes {
  readonly r: Plane;
  readonly g: Plane;
  readonly b: Plane;
}
