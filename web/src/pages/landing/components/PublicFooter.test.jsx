import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicFooter from "./PublicFooter";

vi.mock("../../../components/auth/StaffSignInButton", () => ({
  default: () => <button>Staff Sign In</button>,
}));

afterEach(() => vi.unstubAllGlobals());

describe("Footer back to top", () => {
  it.each([false, true])("scrolls and moves keyboard focus with reduced motion=%s", (reduced) => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: reduced })));
    render(<><section id="home" tabIndex={-1}>Home</section><PublicFooter /></>);

    fireEvent.click(screen.getByRole("button", { name: "Back to top" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: reduced ? "instant" : "smooth" });
    expect(document.getElementById("home")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Staff Sign In" })).toBeEnabled();
  });
});
