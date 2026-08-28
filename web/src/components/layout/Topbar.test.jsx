import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Topbar from "./Topbar";

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({
    user: { publicMetadata: { role: "admin" } },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [] }),
  useMutation: () => ({ mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("../../contexts/SidebarContext", () => ({
  useSidebar: () => ({ toggle: vi.fn() }),
}));

vi.mock("../../lib/axios", () => ({
  default: {},
}));

describe("Admin Topbar theme controls", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.setAttribute("data-theme", "breedsmart");
  });

  it("orders Theme, Refresh, and Notifications without changing header size", () => {
    render(
      <Topbar title="Admin Portal" subtitle="Municipal operations">
        <button type="button">Refresh</button>
      </Topbar>,
    );

    const theme = screen.getByRole("button", { name: "Switch to dark mode" });
    const refresh = screen.getByRole("button", { name: "Refresh" });
    const notifications = screen.getByRole("button", {
      name: "Open notifications",
    });

    expect(
      theme.compareDocumentPosition(refresh) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      refresh.compareDocumentPosition(notifications) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(theme.parentElement).toHaveAttribute("data-tip", "Light mode");
  });

  it("switches and persists the centralized Admin theme immediately", () => {
    render(<Topbar title="Admin Portal" />);

    const toggle = screen.getByRole("button", {
      name: "Switch to dark mode",
    });
    fireEvent.click(toggle);

    expect(document.documentElement).toHaveAttribute(
      "data-theme",
      "breedsmart-dark",
    );
    expect(localStorage.getItem("theme")).toBe("breedsmart-dark");
    expect(toggle).toHaveAccessibleName("Switch to light mode");
    expect(toggle.parentElement).toHaveAttribute("data-tip", "Dark mode");

    fireEvent.click(toggle);

    expect(document.documentElement).toHaveAttribute(
      "data-theme",
      "breedsmart",
    );
    expect(localStorage.getItem("theme")).toBe("breedsmart");
    expect(toggle).toHaveAccessibleName("Switch to dark mode");
  });
});
