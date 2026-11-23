import { huffmanDecodeBytes, huffmanEncodeBytes } from "./huffman";
import type { RgbaImage } from "./types";

export type PngFilter = "none" | "sub" | "up" | "average" | "paeth";

export interface EncodedBytes {
  bytes: Uint8Array;
  encodedBytes: number;
}

export type LosslessMethodId = "rle" | "huffman" | "lzw" | "dpcm" | "png";

export interface LosslessMethod {
  id: LosslessMethodId;
  encodedBytes: number;
}

export interface LosslessReport {
  rawBytes: number;
  entropyBits: number;
  methods: LosslessMethod[];
}

export function lumaBytes(image: RgbaImage): Uint8Array {
  const out = new Uint8Array(image.width * image.height);
  for (let i = 0; i < out.length; i += 1) {
    const base = i * 4;
    const r = image.data[base] ?? 0;
    const g = image.data[base + 1] ?? 0;
    const b = image.data[base + 2] ?? 0;
    out[i] = Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
  }
  return out;
}

export function byteEntropyBits(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const counts = new Uint32Array(256);
  for (const byte of bytes) counts[byte] = (counts[byte] ?? 0) + 1;
  let entropy = 0;
  for (const count of counts) {
    if (count === 0) continue;
    const probability = count / bytes.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

export function rleEncode(bytes: Uint8Array): EncodedBytes {
  const output: number[] = [];
  let index = 0;
  while (index < bytes.length) {
    const value = bytes[index] ?? 0;
    let run = 1;
    while (index + run < bytes.length && bytes[index + run] === value && run < 255) run += 1;
    output.push(run, value);
    index += run;
  }
  return { bytes: Uint8Array.from(output), encodedBytes: output.length };
}

export function rleDecode(encoded: Uint8Array): Uint8Array {
  if (encoded.length % 2 !== 0) throw new Error("invalid rle stream");
  const output: number[] = [];
  for (let i = 0; i < encoded.length; i += 2) {
    const run = encoded[i] ?? 0;
    const value = encoded[i + 1] ?? 0;
    if (run === 0) throw new Error("invalid rle run");
    for (let j = 0; j < run; j += 1) output.push(value);
  }
  return Uint8Array.from(output);
}

export function huffmanEncode(bytes: Uint8Array): EncodedBytes & { lengths: Uint8Array } {
  const result = huffmanEncodeBytes(bytes);
  return { bytes: result.bytes, encodedBytes: result.bytes.length, lengths: result.lengths };
}

export function huffmanDecode(encoded: Uint8Array, lengths: Uint8Array, count: number): Uint8Array {
  return huffmanDecodeBytes(encoded, lengths, count);
}

export function lzwEncode(bytes: Uint8Array): EncodedBytes {
  if (bytes.length === 0) return { bytes: new Uint8Array(0), encodedBytes: 0 };
  const dictionary = new Map<number, number>();
  let nextCode = 256;
  const codes: number[] = [];
  let prefix = bytes[0] ?? 0;
  for (let i = 1; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0;
    const key = prefix * 256 + byte;
    const code = dictionary.get(key);
    if (code !== undefined) {
      prefix = code;
      continue;
    }
    codes.push(prefix);
    if (nextCode < 65536) {
      dictionary.set(key, nextCode);
      nextCode += 1;
    }
    prefix = byte;
  }
  codes.push(prefix);
  const output = new Uint8Array(codes.length * 2);
  codes.forEach((code, index) => {
    output[index * 2] = (code >> 8) & 0xff;
    output[index * 2 + 1] = code & 0xff;
  });
  return { bytes: output, encodedBytes: output.length };
}

export function lzwDecode(encoded: Uint8Array): Uint8Array {
  if (encoded.length % 2 !== 0) throw new Error("invalid lzw stream");
  const dictionary: number[][] = [];
  for (let i = 0; i < 256; i += 1) dictionary.push([i]);
  let nextCode = 256;
  const output: number[] = [];
  let previous: number[] | null = null;
  for (let i = 0; i < encoded.length; i += 2) {
    const code = ((encoded[i] ?? 0) << 8) | (encoded[i + 1] ?? 0);
    let entry: number[];
    if (code < nextCode && dictionary[code]) {
      entry = dictionary[code] as number[];
    } else if (code === nextCode && previous) {
      entry = [...previous, previous[0] ?? 0];
    } else {
      throw new Error("invalid lzw code");
    }
    output.push(...entry);
    if (previous && nextCode < 65536) {
      dictionary[nextCode] = [...previous, entry[0] ?? 0];
      nextCode += 1;
    }
    previous = entry;
  }
  return Uint8Array.from(output);
}

export function dpcmResiduals(bytes: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = bytes[index] ?? 0;
      const predictor = x === 0 ? 0 : (bytes[index - 1] ?? 0);
      out[index] = (value - predictor) & 0xff;
    }
  }
  return out;
}

export function dpcmDecode(residuals: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(residuals.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const predictor = x === 0 ? 0 : (out[index - 1] ?? 0);
      out[index] = ((residuals[index] ?? 0) + predictor) & 0xff;
    }
  }
  return out;
}

function paethPredictor(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpperLeft = Math.abs(estimate - upperLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpperLeft) return left;
  if (distanceUp <= distanceUpperLeft) return up;
  return upperLeft;
}

function filterValue(
  filter: PngFilter,
  value: number,
  left: number,
  up: number,
  upperLeft: number,
): number {
  switch (filter) {
    case "none":
      return value;
    case "sub":
      return (value - left) & 0xff;
    case "up":
      return (value - up) & 0xff;
    case "average":
      return (value - Math.floor((left + up) / 2)) & 0xff;
    case "paeth":
      return (value - paethPredictor(left, up, upperLeft)) & 0xff;
  }
}

function unfilterValue(
  filter: PngFilter,
  residual: number,
  left: number,
  up: number,
  upperLeft: number,
): number {
  switch (filter) {
    case "none":
      return residual;
    case "sub":
      return (residual + left) & 0xff;
    case "up":
      return (residual + up) & 0xff;
    case "average":
      return (residual + Math.floor((left + up) / 2)) & 0xff;
    case "paeth":
      return (residual + paethPredictor(left, up, upperLeft)) & 0xff;
  }
}

export function pngFilter(
  bytes: Uint8Array,
  width: number,
  height: number,
  filter: PngFilter,
): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const left = x === 0 ? 0 : (bytes[index - 1] ?? 0);
      const up = y === 0 ? 0 : (bytes[index - width] ?? 0);
      const upperLeft = x === 0 || y === 0 ? 0 : (bytes[index - width - 1] ?? 0);
      out[index] = filterValue(filter, bytes[index] ?? 0, left, up, upperLeft);
    }
  }
  return out;
}

export function pngUnfilter(
  filtered: Uint8Array,
  width: number,
  height: number,
  filter: PngFilter,
): Uint8Array {
  const out = new Uint8Array(filtered.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const left = x === 0 ? 0 : (out[index - 1] ?? 0);
      const up = y === 0 ? 0 : (out[index - width] ?? 0);
      const upperLeft = x === 0 || y === 0 ? 0 : (out[index - width - 1] ?? 0);
      out[index] = unfilterValue(filter, filtered[index] ?? 0, left, up, upperLeft);
    }
  }
  return out;
}

export function pngAdaptiveFilter(
  bytes: Uint8Array,
  width: number,
  height: number,
): { filtered: Uint8Array; filters: PngFilter[] } {
  const filters: PngFilter[] = [];
  const rows: Uint8Array[] = [];
  for (let y = 0; y < height; y += 1) {
    const row = bytes.subarray(y * width, (y + 1) * width);
    let best: Uint8Array | null = null;
    let bestFilter: PngFilter = "none";
    let bestScore = Number.POSITIVE_INFINITY;
    for (const filter of ["none", "sub", "up", "average", "paeth"] as const) {
      const candidate = new Uint8Array(width);
      for (let x = 0; x < width; x += 1) {
        const left = x === 0 ? 0 : (row[x - 1] ?? 0);
        const up = y === 0 ? 0 : (bytes[(y - 1) * width + x] ?? 0);
        const upperLeft = x === 0 || y === 0 ? 0 : (bytes[(y - 1) * width + x - 1] ?? 0);
        candidate[x] = filterValue(filter, row[x] ?? 0, left, up, upperLeft);
      }
      let score = 0;
      for (const value of candidate) score += Math.abs(value > 127 ? value - 256 : value);
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
        bestFilter = filter;
      }
    }
    filters.push(bestFilter);
    rows.push(best ?? new Uint8Array(width));
  }
  const filtered = new Uint8Array(bytes.length);
  for (let index = 0; index < rows.length; index += 1) {
    filtered.set(rows[index] ?? new Uint8Array(width), index * width);
  }
  return { filtered, filters };
}

export function losslessReport(image: RgbaImage): LosslessReport {
  const bytes = lumaBytes(image);
  const rle = rleEncode(bytes);
  const huffman = huffmanEncodeBytes(bytes);
  const lzw = lzwEncode(bytes);
  const residuals = dpcmResiduals(bytes, image.width, image.height);
  const dpcm = huffmanEncodeBytes(residuals);
  const adaptive = pngAdaptiveFilter(bytes, image.width, image.height);
  const png = huffmanEncodeBytes(adaptive.filtered);
  return {
    rawBytes: bytes.length,
    entropyBits: byteEntropyBits(bytes),
    methods: [
      { id: "rle", encodedBytes: rle.encodedBytes },
      { id: "huffman", encodedBytes: huffman.bytes.length },
      { id: "lzw", encodedBytes: lzw.encodedBytes },
      { id: "dpcm", encodedBytes: dpcm.bytes.length },
      { id: "png", encodedBytes: png.bytes.length },
    ],
  };
}
