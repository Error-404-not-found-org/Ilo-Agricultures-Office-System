import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings";
import settingsSource from "./Settings.jsx?raw";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../lib/axios", () => ({
  default: { get: mocks.get },
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({
    success: mocks.success,
    error: mocks.error,
  }),
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));

describe("Admin Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:settings-export"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows only the verified system data export capability", () => {
    render(<Settings />);

    expect(screen.getByRole("heading", { name: "System Settings" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "System Data Export" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export System Data" })).toBeTruthy();

    const pageText = document.body.textContent;
    expect(pageText).not.toContain("Pregnancy Diagnosis Window");
    expect(pageText).not.toContain("Max Insemination Retries");
    expect(pageText).not.toContain("Email System Alerts");
    expect(pageText).not.toContain("SMS Technician Broadcasts");
    expect(pageText).not.toContain("Registered Breeding Genotypes Catalog");
    expect(pageText).not.toContain("Add Breed");
    expect(pageText).not.toContain("Save Settings");
    expect(pageText).not.toContain("Clear Cached Session");
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("keeps the existing export endpoint reachable", async () => {
    mocks.get.mockResolvedValue({ data: "{}" });
    render(<Settings />);

    fireEvent.click(screen.getByRole("button", { name: "Export System Data" }));

    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledWith("/admin/backup", {
        responseType: "blob",
      });
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("System data export downloaded.");
  });

  it("contains no dormant config writes, broad storage clears, or profile controls", () => {
    expect(settingsSource).not.toMatch(
      /pregnancyWindowDays|maxAttemptLimit|emailNotificationEnabled|smsNotificationEnabled|registered_breeds/,
    );
    expect(settingsSource).not.toContain("/config/settings");
    expect(settingsSource).not.toContain("localStorage.clear");
    expect(settingsSource).not.toContain("sessionStorage.clear");
    expect(settingsSource).not.toMatch(/@clerk|useUser|profile/i);
  });
});
