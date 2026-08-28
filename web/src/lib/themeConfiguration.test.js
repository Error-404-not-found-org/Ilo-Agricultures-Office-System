import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/index.css", "utf8");
const html = readFileSync("index.html", "utf8");
const main = readFileSync("src/main.jsx", "utf8");

describe("BreedSmart DaisyUI theme foundations", () => {
  it("uses a LoFi-derived light foundation with BreedSmart green", () => {
    expect(css).toContain("LoFi-derived light foundation");
    expect(css).toContain("--color-base-200: oklch(97% 0 0)");
    expect(css).toContain("--color-base-300: oklch(94% 0 0)");
    expect(css).toContain("--color-primary: #00643b");
    expect(css).toContain("--color-warning-content: #271703");
  });

  it("uses a Forest-derived dark foundation", () => {
    expect(css).toContain("Forest-derived dark foundation");
    expect(css).toContain("--color-base-100: oklch(20.84% 0.008 17.911)");
    expect(css).toContain("--color-base-200: oklch(18.522% 0.007 17.911)");
    expect(css).toContain("--color-base-300: oklch(16.203% 0.007 17.911)");
  });

  it("starts with and initializes the persisted BreedSmart theme", () => {
    expect(html).toContain('data-theme="breedsmart"');
    expect(main).toContain("applyTheme(getStoredTheme())");
  });
});
