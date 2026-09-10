import { fireEvent, render, screen } from "@testing-library/react";
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
vi.mock("./components/layout/ProtectedTechnicianRoute", () => ({
  default: ({ children }) => children || <Outlet />,
}));
vi.mock("./components/layout/AppLayout", () => ({
  default: () => (
    <div data-testid="authenticated-layout">
      <Outlet />
    </div>
  ),
}));

const renderRoute = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

describe("role-aware Not Found routes", () => {
  it("shows a public Not Found page without redirecting to the landing page", () => {
    renderRoute("/not-real");

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect(screen.getByRole("link", { name: /BreedSmart Home/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.queryByTestId("authenticated-layout")).not.toBeInTheDocument();
  });

  it("shows an unknown Admin route without the sidebar layout", () => {
    renderRoute("/admin/not-real");

    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    expect(screen.queryByTestId("authenticated-layout")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Admin Dashboard/i })).toHaveAttribute(
      "href",
      "/admin/dashboard",
    );
  });

  it("shows an unknown Technician route without the sidebar layout", () => {
    renderRoute("/technician/not-real");

    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    expect(screen.queryByTestId("authenticated-layout")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Technician Dashboard/i }),
    ).toHaveAttribute("href", "/technician/dashboard");
  });
});

vi.mock("./pages/technician/DashboardTechnician", () => ({
  default: () => <h1>Technician Dashboard</h1>,
}));
vi.mock("./pages/technician/Requests", () => ({
  default: () => <h1>Technician Requests</h1>,
}));
vi.mock("./pages/technician/Records", () => ({
  default: () => <h1>Technician Records</h1>,
}));

function HistoryProbe() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return <><output aria-label="Current path">{pathname}</output><button onClick={() => navigate(-1)}>Back</button></>;
}

describe("Technician landing route", () => {
  it.each([
    ["/technician", "Technician Dashboard", "/technician/dashboard"],
    ["/technician/", "Technician Dashboard", "/technician/dashboard"],
    ["/technician/dashboard", "Technician Dashboard", "/technician/dashboard"],
    ["/technician/requests", "Technician Requests", "/technician/requests"],
    ["/technician/records", "Technician Records", "/technician/records"],
    ["/technician/this-does-not-exist", "Page not found", "/technician/this-does-not-exist"],
  ])("resolves a fresh router load at %s", async (path, heading, expectedPath) => {
    render(<MemoryRouter initialEntries={[path]}><HistoryProbe /><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    expect(screen.getByLabelText("Current path")).toHaveTextContent(expectedPath);
    if (heading === "Page not found") {
      expect(screen.queryByTestId("authenticated-layout")).not.toBeInTheDocument();
    } else {
      expect(screen.getByTestId("authenticated-layout")).toBeVisible();
    }
  });

  it("replaces the empty root entry so Back returns to the previous page", async () => {
    render(<MemoryRouter initialEntries={["/technician/records", "/technician"]} initialIndex={1}><HistoryProbe /><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Technician Dashboard" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "Technician Records" })).toBeVisible();
    expect(screen.getByLabelText("Current path")).toHaveTextContent("/technician/records");
  });
});


describe("404 recovery actions", () => {
  it("Go Back returns to the previous valid page", async () => {
    render(<MemoryRouter initialEntries={["/technician/records", "/technician/not-real"]} initialIndex={1}><App /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Go Back" }));
    expect(await screen.findByRole("heading", { name: "Technician Records" })).toBeVisible();
    expect(screen.getByTestId("authenticated-layout")).toBeVisible();
  });

  it("the dashboard action returns to the valid Technician layout", async () => {
    renderRoute("/technician/not-real");
    fireEvent.click(screen.getByRole("link", { name: "Technician Dashboard" }));
    expect(await screen.findByRole("heading", { name: "Technician Dashboard" })).toBeVisible();
    expect(screen.getByTestId("authenticated-layout")).toBeVisible();
  });
});
