import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { STAFF_SIGN_IN_INTENT_KEY } from "../../config/staffAccess";
import StaffSignInButton from "./StaffSignInButton";

vi.mock("@clerk/clerk-react", () => ({
  SignInButton: ({ children }) => children,
}));

describe("StaffSignInButton", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("marks landing authentication as a Staff Sign In attempt", () => {
    const onClick = vi.fn();
    render(<StaffSignInButton onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Staff Sign In" }));

    expect(window.sessionStorage.getItem(STAFF_SIGN_IN_INTENT_KEY)).toBe(
      "true",
    );
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
