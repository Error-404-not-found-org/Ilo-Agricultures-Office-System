import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@clerk/clerk-react";
import axiosInstance from "../lib/axios";
import DownloadApp from "./DownloadApp";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(),
  SignedIn: ({ children }) => children,
  SignedOut: ({ children }) => children,
  SignUp: (props) => (
    <div
      data-testid="clerk-farmer-invitation-sign-up"
      data-force-redirect-url={props.forceRedirectUrl}
      data-routing={props.routing}
      data-sign-in-force-redirect-url={props.signInForceRedirectUrl}
    />
  ),
  UserButton: () => <div data-testid="user-button" />,
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, element) =>
        function MotionElement({ children, ...props }) {
          const domProps = { ...props };
          delete domProps.initial;
          delete domProps.animate;
          delete domProps.transition;
          const Element = element;
          return <Element {...domProps}>{children}</Element>;
        },
    },
  ),
}));

vi.mock("../lib/axios", () => ({
  default: {
    post: vi.fn(),
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="route-search">{location.search}</span>;
}

const renderDownload = (route = "/download-app") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <DownloadApp />
      <LocationProbe />
    </MemoryRouter>,
  );

describe("DownloadApp Farmer invitation acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      getToken: vi.fn(),
      isLoaded: true,
      isSignedIn: false,
    });
  });

  it("keeps the normal public download page for signed-out visitors without a ticket", () => {
    renderDownload();

    expect(
      screen.getByRole("heading", { name: /Install BreedSmart Mobile/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Download link not configured")).toBeInTheDocument();
    expect(
      screen.queryByTestId("clerk-farmer-invitation-sign-up"),
    ).not.toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it("mounts Clerk SignUp for a signed-out Farmer invitation", () => {
    renderDownload(
      "/download-app?__clerk_ticket=farmer-ticket&redirect_url=%2Fdownload-app",
    );

    expect(
      screen.getByRole("heading", { name: /Complete your Farmer invitation/i }),
    ).toBeInTheDocument();
    const signUp = screen.getByTestId("clerk-farmer-invitation-sign-up");
    expect(signUp).toHaveAttribute("data-routing", "virtual");
    expect(signUp).toHaveAttribute("data-force-redirect-url", "/download-app");
    expect(signUp).toHaveAttribute(
      "data-sign-in-force-redirect-url",
      "/download-app",
    );
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it("preserves the Clerk ticket in the route while SignUp consumes it", () => {
    renderDownload("/download-app?__clerk_ticket=keep-me&source=invite");

    expect(screen.getByTestId("route-search")).toHaveTextContent(
      "?__clerk_ticket=keep-me&source=invite",
    );
    expect(
      screen.getByTestId("clerk-farmer-invitation-sign-up"),
    ).toBeInTheDocument();
  });

  it("bootstraps a signed-in Farmer before showing the download page", async () => {
    const getToken = vi.fn().mockResolvedValue("farmer-token");
    useAuth.mockReturnValue({ getToken, isLoaded: true, isSignedIn: true });
    axiosInstance.post.mockResolvedValue({
      data: { user: { role: "farmer", profileClaimStatus: "claimed" } },
    });

    renderDownload("/download-app?__clerk_ticket=accepted-ticket");

    expect(screen.getByRole("status")).toHaveTextContent(
      "Confirming your account",
    );
    expect(
      await screen.findByRole("heading", { name: /Install BreedSmart Mobile/i }),
    ).toBeInTheDocument();
    expect(axiosInstance.post).toHaveBeenCalledWith(
      "/user/bootstrap",
      {},
      { headers: { Authorization: "Bearer farmer-token" } },
    );
    expect(
      screen.queryByTestId("clerk-farmer-invitation-sign-up"),
    ).not.toBeInTheDocument();
  });

  it.each(["technician", "admin"])(
    "does not treat a signed-in %s account as a Farmer",
    async (role) => {
      useAuth.mockReturnValue({
        getToken: vi.fn().mockResolvedValue(`${role}-token`),
        isLoaded: true,
        isSignedIn: true,
      });
      axiosInstance.post.mockResolvedValue({ data: { user: { role } } });

      renderDownload();

      await waitFor(() => {
        expect(screen.getByText(/not a Farmer account/i)).toBeInTheDocument();
      });
      expect(
        screen.queryByRole("heading", { name: /Install BreedSmart Mobile/i }),
      ).not.toBeInTheDocument();
    },
  );
});
