import { beforeEach, describe, expect, it } from "vitest";
import { applyTheme, isDarkTheme, normalizeTheme } from "./theme";

describe("web theme configuration", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  it("migrates the previous built-in theme names", () => {
    expect(normalizeTheme("emerald")).toBe("breedsmart");
    expect(normalizeTheme("night")).toBe("breedsmart-dark");
    expect(normalizeTheme("lofi")).toBe("breedsmart");
    expect(normalizeTheme("forest")).toBe("breedsmart-dark");
  });

  it("migrates retired dark choices to the Forest-based dark theme", () => {
    expect(normalizeTheme("black")).toBe("breedsmart-dark");
    expect(normalizeTheme("dracula")).toBe("breedsmart-dark");
  });

  it("classifies all optional choices for dark-compatible components", () => {
    expect(isDarkTheme("breedsmart")).toBe(false);
    expect(isDarkTheme("breedsmart-dark")).toBe(true);
    expect(isDarkTheme("forest")).toBe(true);
    expect(isDarkTheme("lofi")).toBe(false);
  });

  it("switches between the LoFi-based light and Forest-based dark themes", () => {
    expect(applyTheme("breedsmart-dark")).toBe("breedsmart-dark");
    expect(document.documentElement).toHaveAttribute(
      "data-theme",
      "breedsmart-dark",
    );
    expect(document.documentElement).toHaveClass("dark");

    expect(applyTheme("breedsmart")).toBe("breedsmart");
    expect(document.documentElement).toHaveAttribute(
      "data-theme",
      "breedsmart",
    );
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
