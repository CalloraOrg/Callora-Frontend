import { describe, it, expect } from "vitest";
import { colorFromId, colorFromIdLight, colorFromIdDark } from "./colorFromId";

describe("colorFromId", () => {
  it("returns a CSS hsl() string", () => {
    const color = colorFromId("weather-001");
    expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
  });

  it("is deterministic — same id always produces the same colour", () => {
    const a = colorFromId("api-1");
    const b = colorFromId("api-1");
    expect(a).toBe(b);
  });

  it("produces different colours for different ids", () => {
    const ids = ["api-1", "api-2", "weather-001", "geo-042", "auth-999"];
    const colours = ids.map(colorFromId);
    const unique = new Set(colours);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("handles empty string without throwing", () => {
    expect(() => colorFromId("")).not.toThrow();
    expect(colorFromId("")).toMatch(/^hsl\(/);
  });

  it("handles unicode ids", () => {
    expect(colorFromId("api-日本語")).toMatch(/^hsl\(/);
  });
});

describe("colorFromIdLight", () => {
  it("returns a lighter CSS hsl() string", () => {
    const color = colorFromIdLight("api-1");
    expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
  });

  it("has higher lightness than colorFromId", () => {
    const normal = colorFromId("api-1");
    const light = colorFromIdLight("api-1");
    const getL = (s: string) => parseInt(s.split(",")[2]);
    expect(getL(light)).toBeGreaterThan(getL(normal));
  });

  it("is deterministic", () => {
    expect(colorFromIdLight("x")).toBe(colorFromIdLight("x"));
  });
});

describe("colorFromIdDark", () => {
  it("returns a darker CSS hsl() string", () => {
    const color = colorFromIdDark("api-1");
    expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
  });

  it("has lower lightness than colorFromId", () => {
    const normal = colorFromId("api-1");
    const dark = colorFromIdDark("api-1");
    const getL = (s: string) => parseInt(s.split(",")[2]);
    expect(getL(dark)).toBeLessThan(getL(normal));
  });

  it("is deterministic", () => {
    expect(colorFromIdDark("x")).toBe(colorFromIdDark("x"));
  });
});
