import { useRef } from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let ScrollTrigger;
let useLandingAnimations;

function ReducedMotionHarness() {
  const scope = useRef(null);
  useLandingAnimations(scope);

  return (
    <div ref={scope}>
      <section data-motion-section>
        <div
          data-motion-intro
          style={{ opacity: 0, visibility: "hidden", transform: "translateY(20px)" }}
        >
          Visible landing content
        </div>
      </section>
    </div>
  );
}

describe("useLandingAnimations", () => {
  beforeAll(async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    ({ ScrollTrigger } = await import("gsap/ScrollTrigger"));
    ({ default: useLandingAnimations } = await import("./useLandingAnimations"));
  });

  afterEach(() => {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  });

  it("leaves content visible and creates no scroll triggers for reduced motion", () => {
    const { getByText } = render(<ReducedMotionHarness />);
    const content = getByText("Visible landing content");

    expect(content).toBeVisible();
    expect(content).toHaveStyle({ opacity: "1", visibility: "visible" });
    expect(getComputedStyle(content).transform).toBe("none");
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});
