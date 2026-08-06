import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProtectedTechnicianRoute from "../layout/ProtectedTechnicianRoute";
import { useUser, useAuth } from "@clerk/clerk-react";

// Mock @clerk/clerk-react
vi.mock("@clerk/clerk-react", () => ({
  useUser: vi.fn(),
  useAuth: vi.fn(),
}));

// Mock react-router-dom
vi.mock("react-router-dom", () => ({
  Navigate: vi.fn(({ to }) => <div data-testid="navigate" data-to={to}>Redirected</div>),
  Outlet: vi.fn(() => <div data-testid="outlet">Outlet Content</div>),
}));

// Mock axiosInstance
vi.mock("../lib/axios", () => ({
  default: {
    interceptors: {
      request: {
        use: vi.fn(() => 123),
        eject: vi.fn(),
      },
    },
  },
}));

describe("ProtectedTechnicianRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      getToken: vi.fn().mockResolvedValue("mock-token"),
    });
  });

  it("shows loading spinner when Clerk user is not loaded", async () => {
    useUser.mockReturnValue({
      isLoaded: false,
      user: null,
    });

    const { container } = render(
      <ProtectedTechnicianRoute>
        <div data-testid="child">Children Content</div>
      </ProtectedTechnicianRoute>
    );
    const loadingSpinner = container.querySelector(".loading");
    expect(loadingSpinner).toBeInTheDocument();

    // Await the state updates so they resolve inside act
    await waitFor(() => {
      expect(container.querySelector(".loading")).toBeInTheDocument();
    });
  });

  it("redirects to home if user has no technician role", async () => {
    useUser.mockReturnValue({
      isLoaded: true,
      user: {
        publicMetadata: {
          role: "farmer",
        },
      },
    });

    render(
      <ProtectedTechnicianRoute>
        <div data-testid="child">Children Content</div>
      </ProtectedTechnicianRoute>
    );

    await waitFor(() => {
      expect(screen.getByTestId("navigate")).toBeInTheDocument();
      expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/");
    });
  });

  it("renders children if user role is technician", async () => {
    useUser.mockReturnValue({
      isLoaded: true,
      user: {
        publicMetadata: {
          role: "technician",
        },
      },
    });

    render(
      <ProtectedTechnicianRoute>
        <div data-testid="child">Children Content</div>
      </ProtectedTechnicianRoute>
    );

    await waitFor(() => {
      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
    });
  });

});
