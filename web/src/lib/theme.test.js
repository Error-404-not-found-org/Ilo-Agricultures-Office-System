import { describe, expect, it } from "vitest";
import { isDarkTheme, normalizeTheme } from "./theme";

describe("web theme configuration", () => {
  it("migrates the previous built-in theme names", () => {
    expect(normalizeTheme("emerald")).toBe("breedsmart");
    expect(normalizeTheme("night")).toBe("breedsmart-dark");
  });

  it("keeps supported optional DaisyUI themes", () => {
    expect(normalizeTheme("black")).toBe("black");
    expect(normalizeTheme("dracula")).toBe("dracula");
  });

  it("classifies all optional choices for dark-compatible components", () => {
    expect(isDarkTheme("breedsmart")).toBe(false);
    expect(isDarkTheme("breedsmart-dark")).toBe(true);
    expect(isDarkTheme("black")).toBe(true);
    expect(isDarkTheme("dracula")).toBe(true);
  });
});
