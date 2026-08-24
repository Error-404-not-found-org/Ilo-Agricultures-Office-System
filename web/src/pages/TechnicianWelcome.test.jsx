import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@clerk/clerk-react";
import axiosInstance from "../lib/axios";
import TechnicianWelcome from "./TechnicianWelcome";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(),
  SignInButton: ({ children }) => children,
  SignUp: (props) => (
    <div
      data-testid="clerk-invitation-sign-up"
      data-force-redirect-url={props.forceRedirectUrl}
      data-routing={props.routing}
      data-sign-in-force-redirect-url={props.signInForceRedirectUrl}
    />
  ),
  UserButton: () => <div data-testid="user-button" />,
}));

vi.mock("../lib/axios", () => ({
  default: {
    post: vi.fn(),
  },
}));

const renderWelcome = (route = "/technician/welcome") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <TechnicianWelcome />
    </MemoryRouter>,
  );

describe("TechnicianWelcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      getToken: vi.fn().mockResolvedValue("token-1"),
      isLoaded: true,
      isSignedIn: true,
    });
  });

  it("uses backend identity and does not trust a technician URL role", async () => {
    axiosInstance.post.mockResolvedValue({
      data: { user: { role: "farmer" } },
    });

    renderWelcome("/technician/welcome?role=technician");

    await waitFor(() => {
      expect(
        screen.getByText(/not an approved Technician account/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("link", { name: /Open BreedSmart App/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Technician continuation only after backend bootstrap confirms the role", async () => {
    axiosInstance.post.mockResolvedValue({
      data: { user: { role: "technician", profileClaimStatus: "claimed" } },
    });

    renderWelcome();

    const appLink = await screen.findByRole("link", {
      name: /Open BreedSmart App/i,
    });
    expect(appLink).toHaveAttribute("href", "ilo-agriculture://");
    expect(
      screen.getByRole("link", { name: /Continue on Web/i }),
    ).toHaveAttribute("href", "/technician/dashboard");
    expect(axiosInstance.post).toHaveBeenCalledWith(
      "/user/bootstrap",
      {},
      { headers: { Authorization: "Bearer token-1" } },
    );
  });

  it("offers a safe sign-in path without calling bootstrap when signed out", () => {
    useAuth.mockReturnValue({
      getToken: vi.fn(),
      isLoaded: true,
      isSignedIn: false,
    });

    renderWelcome();

    expect(screen.getByRole("button", { name: /Sign in/i })).toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it("passes Clerk invitation ticket state to the embedded invitation sign-up flow", () => {
    useAuth.mockReturnValue({
      getToken: vi.fn(),
      isLoaded: true,
      isSignedIn: false,
    });

    renderWelcome(
      "/technician/welcome?__clerk_ticket=invitation-ticket&redirect_url=%2Ftechnician%2Fwelcome",
    );

    const signUp = screen.getByTestId("clerk-invitation-sign-up");
    expect(signUp).toHaveAttribute("data-routing", "virtual");
    expect(signUp).toHaveAttribute(
      "data-force-redirect-url",
      "/technician/welcome",
    );
    expect(signUp).toHaveAttribute(
      "data-sign-in-force-redirect-url",
      "/technician/welcome",
    );
    expect(
      screen.queryByRole("button", { name: /Sign in/i }),
    ).not.toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it("renders the welcome actions after invitation acceptance creates a Technician session", async () => {
    axiosInstance.post.mockResolvedValue({
      data: { user: { role: "technician", profileClaimStatus: "claimed" } },
    });

    renderWelcome("/technician/welcome?__clerk_ticket=accepted-ticket");

    expect(
      await screen.findByRole("link", { name: /Open BreedSmart App/i }),
    ).toHaveAttribute("href", "ilo-agriculture://");
    expect(
      screen.queryByTestId("clerk-invitation-sign-up"),
    ).not.toBeInTheDocument();
  });
});
