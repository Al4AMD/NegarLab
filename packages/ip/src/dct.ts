const SIZE = 8;
const HALF_PI_OVER_16 = Math.PI / 16;

const COSINE: Float64Array = (() => {
  const table = new Float64Array(SIZE * SIZE);
  for (let u = 0; u < SIZE; u += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      table[u * SIZE + x] = Math.cos((2 * x + 1) * u * HALF_PI_OVER_16);
    }
  }
  return table;
})();

const SCALE: Float64Array = (() => {
  const table = new Float64Array(SIZE);
  for (let u = 0; u < SIZE; u += 1) {
    table[u] = u === 0 ? Math.SQRT1_2 : 1;
  }
  return table;
})();

export const ZIGZAG: readonly number[] = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20,
  13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52,
  45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
];

export function dct8(block: Float64Array): Float64Array {
  if (block.length !== SIZE * SIZE) {
    throw new RangeError("dct8 expects a 64-value block");
  }
  const rows = new Float64Array(SIZE * SIZE);
  const out = new Float64Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let u = 0; u < SIZE; u += 1) {
      let sum = 0;
      for (let x = 0; x < SIZE; x += 1) {
        sum += (block[y * SIZE + x] ?? 0) * (COSINE[u * SIZE + x] ?? 0);
      }
      rows[y * SIZE + u] = 0.5 * (SCALE[u] ?? 0) * sum;
    }
  }
  for (let v = 0; v < SIZE; v += 1) {
    for (let u = 0; u < SIZE; u += 1) {
      let sum = 0;
      for (let y = 0; y < SIZE; y += 1) {
        sum += (rows[y * SIZE + u] ?? 0) * (COSINE[v * SIZE + y] ?? 0);
      }
      out[v * SIZE + u] = 0.5 * (SCALE[v] ?? 0) * sum;
    }
  }
  return out;
}

export function idct8(coeffs: Float64Array): Float64Array {
  if (coeffs.length !== SIZE * SIZE) {
    throw new RangeError("idct8 expects a 64-value block");
  }
  const columns = new Float64Array(SIZE * SIZE);
  const out = new Float64Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let u = 0; u < SIZE; u += 1) {
      let sum = 0;
      for (let v = 0; v < SIZE; v += 1) {
        sum += (SCALE[v] ?? 0) * (coeffs[v * SIZE + u] ?? 0) * (COSINE[v * SIZE + y] ?? 0);
      }
      columns[y * SIZE + u] = 0.5 * sum;
    }
  }
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let sum = 0;
      for (let u = 0; u < SIZE; u += 1) {
        sum += (SCALE[u] ?? 0) * (columns[y * SIZE + u] ?? 0) * (COSINE[u * SIZE + x] ?? 0);
      }
      out[y * SIZE + x] = 0.5 * sum;
    }
  }
  return out;
}

export function dctBasis(u: number, v: number): Float64Array {
  if (!Number.isInteger(u) || !Number.isInteger(v) || u < 0 || v < 0 || u >= SIZE || v >= SIZE) {
    throw new RangeError("basis indices must be integers in 0..7");
  }
  const out = new Float64Array(SIZE * SIZE);
  const scale = 0.25 * (SCALE[u] ?? 0) * (SCALE[v] ?? 0);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      out[y * SIZE + x] = scale * (COSINE[u * SIZE + x] ?? 0) * (COSINE[v * SIZE + y] ?? 0);
    }
  }
  return out;
}

export function zigzag(coeffs: Float64Array | Int32Array): number[] {
  if (coeffs.length !== SIZE * SIZE) {
    throw new RangeError("zigzag expects 64 coefficients");
  }
  return ZIGZAG.map((index) => coeffs[index] ?? 0);
}

const LUMA_TABLE: readonly number[] = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113,
  92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];

const CHROMA_TABLE: readonly number[] = [
  17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99,
  47, 66, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
];

function scaleTable(base: readonly number[], quality: number): Int32Array {
  const q = Math.min(100, Math.max(1, Math.round(quality)));
  const scale = q < 50 ? 5000 / q : 200 - 2 * q;
  const out = new Int32Array(SIZE * SIZE);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Math.min(255, Math.max(1, Math.floor(((base[i] ?? 1) * scale + 50) / 100)));
  }
  return out;
}

export function jpegQuantTable(quality: number): { luma: Int32Array; chroma: Int32Array } {
  return { luma: scaleTable(LUMA_TABLE, quality), chroma: scaleTable(CHROMA_TABLE, quality) };
}
