import { describe, expect, it } from "vitest";
import { cacheKey } from "./sessionStore";

describe("cacheKey", () => {
  it("is independent of parameter insertion order", () => {
    expect(cacheKey("img", { radius: 3, sigma: 1.5 })).toBe(
      cacheKey("img", { sigma: 1.5, radius: 3 }),
    );
  });

  it("distinguishes nested values, types, and inputs", () => {
    expect(cacheKey("img", { kernel: [1, 2] })).not.toBe(cacheKey("img", { kernel: [2, 1] }));
    expect(cacheKey("img", { size: 1 })).not.toBe(cacheKey("img", { size: "1" }));
    expect(cacheKey("a", {})).not.toBe(cacheKey("b", {}));
  });

  it("ignores undefined parameters", () => {
    expect(cacheKey("img", { radius: 1, extra: undefined })).toBe(cacheKey("img", { radius: 1 }));
  });
});
