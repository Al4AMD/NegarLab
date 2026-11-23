import { describe, expect, it } from "vitest";
import { dct8, dctBasis, idct8, jpegQuantTable, zigzag } from "../src/dct";

describe("dct8", () => {
  it("maps a constant block to a single DC coefficient", () => {
    const block = new Float64Array(64).fill(100);
    const coeffs = dct8(block);
    expect(coeffs[0]).toBeCloseTo(800, 10);
    for (let i = 1; i < coeffs.length; i += 1) expect(coeffs[i]).toBeCloseTo(0, 10);
  });

  it("reconstructs a block through the inverse transform", () => {
    const block = new Float64Array(64);
    for (let i = 0; i < block.length; i += 1) block[i] = ((i * 37) % 256) - 128;
    const restored = idct8(dct8(block));
    for (let i = 0; i < block.length; i += 1) {
      expect(restored[i]).toBeCloseTo(block[i] ?? 0, 10);
    }
  });

  it("rejects blocks of the wrong size", () => {
    expect(() => dct8(new Float64Array(63))).toThrow(RangeError);
    expect(() => idct8(new Float64Array(65))).toThrow(RangeError);
  });
});

describe("dctBasis", () => {
  it("produces 64 orthonormal 8x8 bases", () => {
    let energy = 0;
    for (let v = 0; v < 8; v += 1) {
      for (let u = 0; u < 8; u += 1) {
        const basis = dctBasis(u, v);
        expect(basis).toHaveLength(64);
        let norm = 0;
        for (const value of basis) norm += value * value;
        expect(norm).toBeCloseTo(1, 10);
        energy += norm;
      }
    }
    expect(energy).toBeCloseTo(64, 10);
  });

  it("rejects out-of-range indices", () => {
    expect(() => dctBasis(8, 0)).toThrow(RangeError);
    expect(() => dctBasis(0, -1)).toThrow(RangeError);
  });
});

describe("zigzag", () => {
  it("orders coefficients from DC to the highest frequency", () => {
    const coeffs = new Float64Array(64);
    for (let i = 0; i < 64; i += 1) coeffs[i] = i;
    const scan = zigzag(coeffs);
    expect(scan[0]).toBe(0);
    expect(scan[1]).toBe(1);
    expect(scan[2]).toBe(8);
    expect(scan[63]).toBe(63);
    expect(new Set(scan).size).toBe(64);
  });
});

describe("jpegQuantTable", () => {
  it("returns the standard tables at quality 50", () => {
    const table = jpegQuantTable(50);
    expect(table.luma[0]).toBe(16);
    expect(table.luma[1]).toBe(11);
    expect(table.chroma[0]).toBe(17);
  });

  it("clamps every entry to at least one at quality 100", () => {
    const table = jpegQuantTable(100);
    for (const value of table.luma) expect(value).toBe(1);
    for (const value of table.chroma) expect(value).toBe(1);
  });

  it("scales to large steps at quality 1", () => {
    const table = jpegQuantTable(1);
    expect(table.luma[0]).toBe(255);
  });
});
