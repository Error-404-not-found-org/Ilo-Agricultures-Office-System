import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App from "./App";

vi.mock("@clerk/clerk-react", () => ({
  SignedIn: ({ children }) => children,
  SignedOut: () => null,
  useAuth: () => ({ isSignedIn: false }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("./components/layout/PageMeta", () => ({ default: () => null }));
vi.mock("./contexts/ToastContext", () => ({
  ToastProvider: ({ children }) => children,
}));
vi.mock("./contexts/SidebarContext", () => ({
  SidebarProvider: ({ children }) => children,
}));
vi.mock("./pages/TechnicianWelcome", () => ({
  default: () => <div>Technician invitation welcome route</div>,
}));

describe("public invitation routes", () => {
  it("serves Technician invitation acceptance from /technician/welcome", async () => {
    render(
      <MemoryRouter initialEntries={["/technician/welcome?__clerk_ticket=test"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Technician invitation welcome route"),
    ).toBeInTheDocument();
  });
});
