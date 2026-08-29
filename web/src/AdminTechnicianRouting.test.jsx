import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@clerk/clerk-react", () => ({
  SignedIn: ({ children }) => children,
  SignedOut: () => null,
  useAuth: () => ({ isSignedIn: true }),
  useClerk: () => ({ signOut: vi.fn() }),
}));
vi.mock("./components/layout/PageMeta", () => ({ default: () => null }));
vi.mock("./contexts/ToastContext", () => ({
  ToastProvider: ({ children }) => children,
}));
vi.mock("./contexts/SidebarContext", () => ({
  SidebarProvider: ({ children }) => children,
}));
vi.mock("./components/layout/ProtectedAdminRoute", () => ({
  default: ({ children }) => children || <Outlet />,
}));
vi.mock("./components/layout/AppLayout", () => ({
  default: () => <Outlet />,
}));
vi.mock("./pages/admin/Users", () => ({
  default: () => <div>Canonical Users directory</div>,
}));
vi.mock("./pages/admin/TechnicianProfile", () => ({
  default: () => <div>Technician detail profile</div>,
}));
vi.mock("./pages/admin/Dashboard", () => ({
  default: () => <div>Admin dashboard</div>,
}));

function RouteProbe() {
  const location = useLocation();
  return <output data-testid="route">{location.pathname}{location.search}</output>;
}

function BackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Go back
    </button>
  );
}

function renderApp(initialEntries, initialIndex = initialEntries.length - 1) {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <App />
      <RouteProbe />
      <BackButton />
    </MemoryRouter>,
  );
}

describe("legacy Admin Technician roster routing", () => {
  it("redirects the exact roster route to canonical Technician Users mode", async () => {
    renderApp(["/admin/technicians"]);

    expect(await screen.findByText("Canonical Users directory")).toBeInTheDocument();
    expect(screen.getByTestId("route")).toHaveTextContent(
      "/admin/users?role=technician",
    );
  });

  it("uses replacement navigation so Back does not bounce through the legacy route", async () => {
    renderApp(["/admin/dashboard", "/admin/technicians"]);

    await screen.findByText("Canonical Users directory");
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    expect(await screen.findByText("Admin dashboard")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("route")).toHaveTextContent("/admin/dashboard");
    });
  });

  it("keeps Technician detail URLs on the Technician profile route", async () => {
    renderApp(["/admin/technicians/technician-1"]);

    expect(await screen.findByText("Technician detail profile")).toBeInTheDocument();
    expect(screen.getByTestId("route")).toHaveTextContent(
      "/admin/technicians/technician-1",
    );
    expect(screen.queryByText("Canonical Users directory")).not.toBeInTheDocument();
  });
});
