import { describe, expect, it } from "vitest";
import {
  byteEntropyBits,
  dpcmDecode,
  dpcmResiduals,
  huffmanDecode,
  huffmanEncode,
  losslessReport,
  lumaBytes,
  lzwDecode,
  lzwEncode,
  pngAdaptiveFilter,
  pngFilter,
  pngUnfilter,
  rleDecode,
  rleEncode,
} from "../src/lossless";
import type { RgbaImage } from "../src/types";

function randomBytes(length: number, seed = 12345): Uint8Array {
  const out = new Uint8Array(length);
  let state = seed;
  for (let i = 0; i < length; i += 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    out[i] = state & 0xff;
  }
  return out;
}

function image(width: number, height: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = (i * 37) % 256;
    data[i * 4 + 1] = (i * 17) % 256;
    data[i * 4 + 2] = (i * 97) % 256;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

describe("rle", () => {
  it("round-trips repetitive and random bytes", () => {
    for (const bytes of [
      new Uint8Array(0),
      Uint8Array.from([7]),
      new Uint8Array(1000).fill(4),
      randomBytes(512),
    ]) {
      expect(Array.from(rleDecode(rleEncode(bytes).bytes))).toEqual(Array.from(bytes));
    }
  });

  it("compresses a constant run", () => {
    expect(rleEncode(new Uint8Array(300).fill(9)).encodedBytes).toBe(4);
  });
});

describe("huffman", () => {
  it("round-trips empty, single-symbol, and random data", () => {
    for (const bytes of [
      new Uint8Array(0),
      new Uint8Array(64).fill(3),
      Uint8Array.from([1, 2, 3]),
      randomBytes(1024),
    ]) {
      const encoded = huffmanEncode(bytes);
      expect(Array.from(huffmanDecode(encoded.bytes, encoded.lengths, bytes.length))).toEqual(
        Array.from(bytes),
      );
    }
  });
});

describe("lzw", () => {
  it("round-trips empty, single-byte, and structured data", () => {
    const cases = [
      new Uint8Array(0),
      Uint8Array.from([42]),
      randomBytes(700),
      Uint8Array.from({ length: 200 }, (_, i) => i % 4),
    ];
    for (const bytes of cases) {
      expect(Array.from(lzwDecode(lzwEncode(bytes).bytes))).toEqual(Array.from(bytes));
    }
  });
});

describe("dpcm", () => {
  it("round-trips a plane and uses the left predictor", () => {
    const bytes = randomBytes(35);
    const residuals = dpcmResiduals(bytes, 7, 5);
    expect(Array.from(dpcmDecode(residuals, 7, 5))).toEqual(Array.from(bytes));
    expect(residuals[0]).toBe(bytes[0]);
  });
});

describe("png filters", () => {
  const bytes = randomBytes(9 * 5);

  it.each(["none", "sub", "up", "average", "paeth"] as const)(
    "round-trips the %s filter",
    (filter) => {
      const filtered = pngFilter(bytes, 9, 5, filter);
      expect(Array.from(pngUnfilter(filtered, 9, 5, filter))).toEqual(Array.from(bytes));
    },
  );

  it("zeroes the interior of a constant image for the sub filter", () => {
    const flat = new Uint8Array(24).fill(120);
    const filtered = pngFilter(flat, 6, 4, "sub");
    for (let y = 0; y < 4; y += 1) {
      expect(filtered[y * 6]).toBe(120);
      for (let x = 1; x < 6; x += 1) expect(filtered[y * 6 + x]).toBe(0);
    }
  });

  it("picks one filter per row", () => {
    const adaptive = pngAdaptiveFilter(bytes, 9, 5);
    expect(adaptive.filters).toHaveLength(5);
    expect(adaptive.filtered).toHaveLength(bytes.length);
  });
});

describe("lossless report", () => {
  it("reports every method and a plausible entropy", () => {
    const report = losslessReport(image(8, 8));
    expect(report.rawBytes).toBe(64);
    expect(report.methods.map((method) => method.id)).toEqual([
      "rle",
      "huffman",
      "lzw",
      "dpcm",
      "png",
    ]);
    expect(report.entropyBits).toBeGreaterThan(0);
    expect(report.entropyBits).toBeLessThanOrEqual(8);
    for (const method of report.methods) expect(method.encodedBytes).toBeGreaterThan(0);
  });

  it("extracts luma bytes", () => {
    expect(Array.from(lumaBytes(image(2, 1)))).toEqual([
      0,
      Math.round(0.299 * 37 + 0.587 * 17 + 0.114 * 97),
    ]);
    expect(byteEntropyBits(new Uint8Array(0))).toBe(0);
  });
});
