import { describe, expect, it } from "vitest";
import { fft2, fftMagnitude, fftPhase, fftShift, ifft2 } from "../src/fft";
import type { Plane } from "../src/types";

function plane(width: number, height: number, values: number[]): Plane {
  return { width, height, data: Float32Array.from(values) };
}

describe("fft", () => {
  it("computes the 2x2 DFT of a constant", () => {
    const spectrum = fft2(plane(2, 2, [1, 1, 1, 1]));
    expect(spectrum.re[0]).toBeCloseTo(4, 6);
    expect(Math.hypot(spectrum.re[1] ?? 0, spectrum.im[1] ?? 0)).toBeCloseTo(0, 6);
  });

  it("reconstructs the input through inverse FFT", () => {
    const values = Array.from({ length: 16 }, (_, i) => ((i * 37) % 17) / 16);
    const source = plane(4, 4, values);
    const restored = ifft2(fft2(source));
    restored.data.forEach((value, index) => expect(value).toBeCloseTo(values[index] ?? 0, 6));
  });

  it("satisfies Parseval", () => {
    const source = plane(
      4,
      4,
      Array.from({ length: 16 }, (_, i) => (i % 5) / 5),
    );
    const spectrum = fft2(source);
    let energy = 0;
    for (let i = 0; i < source.data.length; i += 1) energy += (source.data[i] ?? 0) ** 2;
    let spectrumEnergy = 0;
    for (let i = 0; i < spectrum.re.length; i += 1) {
      spectrumEnergy += (spectrum.re[i] ?? 0) ** 2 + (spectrum.im[i] ?? 0) ** 2;
    }
    expect(spectrumEnergy / spectrum.re.length).toBeCloseTo(energy, 6);
  });

  it("shifts four times back to identity and normalizes display planes", () => {
    const spectrum = fft2(
      plane(
        4,
        4,
        Array.from({ length: 16 }, (_, i) => ((i * 3) % 7) / 7),
      ),
    );
    const shifted = fftShift(fftShift(spectrum));
    shifted.re.forEach((value, index) => expect(value).toBeCloseTo(spectrum.re[index] ?? 0, 6));
    for (const display of [fftMagnitude(shifted), fftPhase(shifted)]) {
      display.data.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    }
  });
});
