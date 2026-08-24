import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { STAFF_SIGN_IN_INTENT_KEY } from "../config/staffAccess";
import axiosInstance from "../lib/axios";
import Landing from "./Landing";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(),
  useClerk: vi.fn(),
  useUser: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));

vi.mock("../lib/axios", () => ({
  default: { post: vi.fn() },
}));

vi.mock("./landing/components/PublicNavbar", () => ({
  default: () => <div>PublicNavbar</div>,
}));
vi.mock("./landing/components/LandingHero", () => ({
  default: () => <div>LandingHero</div>,
}));
vi.mock("./landing/components/ValueStrip", () => ({
  default: () => <div>ValueStrip</div>,
}));
vi.mock("./landing/components/HowItWorks", () => ({
  default: () => <div>HowItWorks</div>,
}));
vi.mock("./landing/components/FarmerAppSection", () => ({
  default: () => <div>FarmerAppSection</div>,
}));
vi.mock("./landing/components/StaffPortalSection", () => ({
  default: () => <div>StaffPortalSection</div>,
}));
vi.mock("./landing/components/OtonCommunitySection", () => ({
  default: () => <div>OtonCommunitySection</div>,
}));
vi.mock("./landing/components/AppDownloadSection", () => ({
  default: () => <div>AppDownloadSection</div>,
}));
vi.mock("./landing/components/FinalCTA", () => ({
  default: () => <div>FinalCTA</div>,
}));
vi.mock("./landing/components/PublicFooter", () => ({
  default: () => <div>PublicFooter</div>,
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

const renderLanding = (initialEntry = "/") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Landing />
      <LocationProbe />
    </MemoryRouter>,
  );

describe("Landing staff role resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { publicMetadata: {} },
    });
    useAuth.mockReturnValue({ getToken: vi.fn().mockResolvedValue("token-1") });
    mocks.signOut.mockImplementation(async (callback) => {
      await callback?.();
    });
    useClerk.mockReturnValue({ signOut: mocks.signOut });
  });

  const markStaffSignIn = () =>
    window.sessionStorage.setItem(STAFF_SIGN_IN_INTENT_KEY, "true");

  it("signs a Farmer out after landing Staff Sign In and shows the Staff-only message", async () => {
    useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { publicMetadata: { role: "farmer" } },
    });
    markStaffSignIn();
    axiosInstance.post.mockResolvedValue({
      data: { user: { role: "farmer" } },
    });

    renderLanding();

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledTimes(1);
    });
    expect(mocks.signOut).toHaveBeenCalledWith(expect.any(Function));
    expect(screen.getByTestId("route-path")).toHaveTextContent("/");
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("Staff access only", {
        description:
          "This account is registered as a Farmer. Please use the BreedSmart mobile app to continue.",
      });
    });
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId("route-state")).toHaveTextContent("null");
    });
    expect(window.sessionStorage.getItem(STAFF_SIGN_IN_INTENT_KEY)).toBeNull();
  });

  it("replaces the landing page with a neutral state while rejection is pending", async () => {
    let finishSignOut;
    mocks.signOut.mockImplementation(
      (callback) => new Promise((resolve) => {
        finishSignOut = async () => {
          await callback?.();
          resolve();
        };
      }),
    );
    useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { publicMetadata: { role: "farmer" } },
    });
    markStaffSignIn();
    axiosInstance.post.mockResolvedValue({
      data: { user: { role: "farmer" } },
    });

    renderLanding();

    await waitFor(() => {
      expect(screen.getByText("Signing you out…")).toBeInTheDocument();
    });
    expect(screen.queryByText("PublicNavbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sign Out/i })).not.toBeInTheDocument();

    await act(async () => {
      await finishSignOut();
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("Staff access only", {
        description:
          "This account is registered as a Farmer. Please use the BreedSmart mobile app to continue.",
      });
    });
  });

  it("consumes routed Staff-access feedback exactly once and clears it", async () => {
    useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    });

    renderLanding({
      pathname: "/",
      state: {
        staffAccessMessage: {
          type: "error",
          title: "Staff access only",
          description:
            "This account is registered as a Farmer. Please use the BreedSmart mobile app to continue.",
        },
      },
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledTimes(1);
    });
    expect(mocks.toastError).toHaveBeenCalledWith("Staff access only", {
      description:
        "This account is registered as a Farmer. Please use the BreedSmart mobile app to continue.",
    });
    await waitFor(() => {
      expect(screen.getByTestId("route-state")).toHaveTextContent("null");
    });
  });

  it.each([
    ["technician", "/technician/dashboard"],
    ["admin", "/admin/dashboard"],
  ])(
    "preserves confirmed %s navigation without signing out",
    async (role, expectedPath) => {
      markStaffSignIn();
      axiosInstance.post.mockResolvedValue({ data: { user: { role } } });

      renderLanding();

      await waitFor(() => {
        expect(screen.getByTestId("route-path")).toHaveTextContent(
          expectedPath,
        );
      });
      expect(mocks.signOut).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem(STAFF_SIGN_IN_INTENT_KEY)).toBeNull();
    },
  );

  it("signs an unrecognized profile out with the generic access message", async () => {
    markStaffSignIn();
    axiosInstance.post.mockResolvedValue({
      data: { user: { role: "unsupported" } },
    });

    renderLanding();

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Staff account not recognized",
        {
          description:
            "This account does not have access to the BreedSmart staff workspace. Contact your BreedSmart administrator.",
        },
      );
    });
  });

  it("signs out safely when no BreedSmart profile can be confirmed", async () => {
    markStaffSignIn();
    axiosInstance.post.mockRejectedValue({
      response: { status: 404, data: { message: "Profile not found" } },
    });

    renderLanding();

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Staff account not recognized",
        {
          description:
            "This account does not have access to the BreedSmart staff workspace. Contact your BreedSmart administrator.",
        },
      );
    });
    expect(screen.getByTestId("route-path")).toHaveTextContent("/");
  });

  it("preserves the existing Farmer download redirect outside Staff Sign In", async () => {
    useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: { publicMetadata: { role: "farmer" } },
    });

    renderLanding();

    await waitFor(() => {
      expect(screen.getByTestId("route-path")).toHaveTextContent(
        "/download-app",
      );
    });
    expect(axiosInstance.post).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
