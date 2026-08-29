import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  clerkAppearance,
  clerkEmbeddedAppearance,
} from "./clerkAppearance";

describe("BreedSmart Clerk appearance", () => {
  it("resolves its semantic variables in both BreedSmart themes", () => {
    const themeCss = readFileSync("src/index.css", "utf8");
    const requiredTokens = [
      "--color-primary",
      "--color-primary-content",
      "--color-base-100",
      "--color-base-200",
      "--color-base-300",
      "--color-base-content",
      "--color-neutral",
      "--color-success",
      "--color-warning",
      "--color-error",
      "--radius-field",
    ];

    for (const token of requiredTokens) {
      expect(themeCss.match(new RegExp(`${token}:`, "g"))).toHaveLength(2);
    }
  });

  it("maps Clerk's global palette and shape to live BreedSmart theme tokens", () => {
    expect(clerkAppearance.variables).toMatchObject({
      colorPrimary: "var(--color-primary)",
      colorPrimaryForeground: "var(--color-primary-content)",
      colorBackground: "var(--color-base-100)",
      colorForeground: "var(--color-base-content)",
      colorMuted: "var(--color-base-200)",
      colorInput: "var(--color-base-100)",
      colorInputForeground: "var(--color-base-content)",
      colorBorder: "var(--color-base-300)",
      colorDanger: "var(--color-error)",
      borderRadius: "var(--radius-field)",
      fontFamily: '"Outfit", sans-serif',
    });
  });

  it("keeps the profile modal on semantic surfaces instead of fixed light colors", () => {
    expect(clerkAppearance.elements.cardBox).toContain("bg-base-100");
    expect(clerkAppearance.elements.cardBox).toContain("border-base-300");
    expect(clerkAppearance.elements.card).toContain("bg-base-100");

    const serializedAppearance = JSON.stringify(clerkAppearance);
    expect(serializedAppearance).not.toMatch(/bg-white|text-slate|border-slate/);
    expect(serializedAppearance).not.toContain("#ffffff");
  });

  it("retains transparent cards only for deliberately embedded auth screens", () => {
    expect(clerkEmbeddedAppearance.elements.card).toMatchObject({
      width: "100%",
      padding: 0,
      background: "transparent",
      boxShadow: "none",
    });
    expect(clerkAppearance.elements.card).not.toContain("bg-transparent");
  });
});
