// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  DENSITY_STORAGE_KEY,
  readDensityPreference,
  persistDensityPreference,
} from "./density";

describe("density preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to comfortable and persists compact selections", () => {
    expect(readDensityPreference()).toBe("comfortable");

    persistDensityPreference("compact");

    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("compact");
    expect(readDensityPreference()).toBe("compact");
  });

  it("falls back to comfortable for invalid stored values", () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, "invalid");

    expect(readDensityPreference()).toBe("comfortable");
  });
});
