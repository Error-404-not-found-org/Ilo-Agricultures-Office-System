import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App from "./App";
import { clerkLocalization } from "./config/clerkAppearance";

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
vi.mock("./pages/DownloadApp", () => ({
  default: () => <div>BreedSmart public download route</div>,
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

  it("serves the canonical public app page from /download-app", async () => {
    render(
      <MemoryRouter initialEntries={["/download-app"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("BreedSmart public download route"),
    ).toBeInTheDocument();
  });

  it("uses one modal-only staff sign-in wrapper across landing triggers", () => {
    const componentFiles = [
      "PublicNavbar.jsx",
      "LandingHero.jsx",
      "StaffPortalSection.jsx",
      "FinalCTA.jsx",
      "PublicFooter.jsx",
    ];

    componentFiles.forEach((file) => {
      const source = readFileSync(
        `src/pages/landing/components/${file}`,
        "utf8",
      );
      expect(source).toContain("StaffSignInButton");
      expect(source).not.toContain('SignInButton } from "@clerk/clerk-react"');
    });

    const sharedButton = readFileSync(
      "src/components/auth/StaffSignInButton.jsx",
      "utf8",
    );
    expect(sharedButton).toContain('mode="modal"');
    expect(sharedButton).toContain("withSignUp={false}");
    expect(clerkLocalization.signIn.start).toMatchObject({
      title: "Staff Sign In",
      subtitle:
        "Sign in with your authorized BreedSmart staff account to access the staff workspace.",
      actionText: "Need access? Contact your BreedSmart administrator.",
    });
  });

  it("points all landing app-download actions to /download-app", () => {
    const files = [
      "./pages/landing/data/landingContent.js",
      "./pages/landing/components/PublicNavbar.jsx",
      "./pages/landing/components/LandingHero.jsx",
      "./pages/landing/components/FarmerAppSection.jsx",
      "./pages/landing/components/FinalCTA.jsx",
    ];

    files.forEach((file) => {
      const source = readFileSync(`src/${file.replace("./", "")}`, "utf8");
      expect(source).toContain("/download-app");
      expect(source).not.toContain('href="#download-app"');
    });
  });
});
