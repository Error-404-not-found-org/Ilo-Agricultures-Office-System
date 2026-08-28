import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth, useClerk } from "@clerk/clerk-react";
import axiosInstance from "../lib/axios";
import TechnicianWelcome from "./TechnicianWelcome";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(),
  useClerk: vi.fn(),
  SignIn: (props) => (
    <button
      type="button"
      data-testid="clerk-inline-sign-in"
      data-force-redirect-url={props.forceRedirectUrl}
      data-routing={props.routing}
      data-with-sign-up={String(props.withSignUp)}
    >
      Staff Sign In
    </button>
  ),
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

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));

vi.mock("../lib/axios", () => ({
  default: {
    post: vi.fn(),
  },
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="route-path">{location.pathname}</span>
      <span data-testid="route-state">{JSON.stringify(location.state)}</span>
    </>
  );
}

const renderWelcome = (route = "/technician/welcome") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <TechnicianWelcome />
      <LocationProbe />
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
    mocks.signOut.mockImplementation(async (callback) => {
      await callback?.();
    });
    useClerk.mockReturnValue({ signOut: mocks.signOut });
  });

  it("signs a Farmer out immediately and returns them to the public landing page", async () => {
    let finishSignOut;
    mocks.signOut.mockImplementation(
      (callback) => new Promise((resolve) => {
        finishSignOut = async () => {
          await callback?.();
          resolve();
        };
      }),
    );
    axiosInstance.post.mockResolvedValue({
      data: { user: { role: "farmer" } },
    });

    renderWelcome("/technician/welcome?role=technician");

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledTimes(1);
    });
    expect(mocks.signOut).toHaveBeenCalledWith(expect.any(Function));
    expect(screen.getByText("Signing you out…")).toBeInTheDocument();
    expect(screen.queryByTestId("user-button")).not.toBeInTheDocument();

    await act(async () => {
      await finishSignOut();
    });

    expect(screen.getByTestId("route-path")).toHaveTextContent("/");
    expect(screen.getByTestId("route-state")).toHaveTextContent(
      '"title":"Staff access only"',
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("link", { name: /Open BreedSmart App/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("user-button")).not.toBeInTheDocument();
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
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("routes a confirmed Admin to the existing Admin workspace without signing out", async () => {
    axiosInstance.post.mockResolvedValue({
      data: { user: { role: "admin", profileClaimStatus: "claimed" } },
    });

    renderWelcome();

    await waitFor(() => {
      expect(screen.getByTestId("route-path")).toHaveTextContent(
        "/admin/dashboard",
      );
    });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("signs an unrecognized staff account out with a generic message", async () => {
    axiosInstance.post.mockResolvedValue({
      data: { user: { role: "unsupported" } },
    });

    renderWelcome();

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("route-state")).toHaveTextContent(
        '"title":"Staff account not recognized"',
      );
    });
    expect(screen.getByTestId("route-path")).toHaveTextContent("/");
    expect(screen.queryByTestId("user-button")).not.toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("signs out without account controls when no BreedSmart profile is found", async () => {
    axiosInstance.post.mockRejectedValue({
      response: { status: 404, data: { message: "Profile not found" } },
    });

    renderWelcome();

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId("route-state")).toHaveTextContent(
        '"title":"Staff account not recognized"',
      );
    });
    expect(screen.getByTestId("route-path")).toHaveTextContent("/");
    expect(screen.queryByTestId("user-button")).not.toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("renders inline staff SignIn without public Sign Up when signed out", () => {
    useAuth.mockReturnValue({
      getToken: vi.fn(),
      isLoaded: true,
      isSignedIn: false,
    });

    renderWelcome();

    const signIn = screen.getByTestId("clerk-inline-sign-in");
    expect(
      screen.getByText(
        "Sign in with your authorized BreedSmart staff account to access the staff workspace.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Need access? Contact your BreedSmart administrator."),
    ).toBeInTheDocument();
    expect(signIn).toHaveAttribute("data-routing", "virtual");
    expect(signIn).toHaveAttribute(
      "data-force-redirect-url",
      "/technician/welcome",
    );
    expect(signIn).toHaveAttribute("data-with-sign-up", "false");
    expect(axiosInstance.post).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
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
      screen.queryByTestId("clerk-inline-sign-in"),
    ).not.toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
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
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
