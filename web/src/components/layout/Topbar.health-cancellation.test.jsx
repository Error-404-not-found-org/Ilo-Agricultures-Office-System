import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Topbar from "./Topbar";

const mocks = vi.hoisted(() => ({ markRead: vi.fn(), notifications: [] }));
vi.mock("@clerk/clerk-react", () => ({ useUser: () => ({ user: { publicMetadata: { role: "technician" } } }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mocks.notifications }),
  useMutation: () => ({ mutate: mocks.markRead }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("../../contexts/SidebarContext", () => ({ useSidebar: () => ({ toggle: vi.fn() }) }));
vi.mock("../../lib/axios", () => ({ default: {} }));

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

describe("Technician Health cancellation notifications", () => {
  it("marks read and navigates to the exact request", () => {
    mocks.markRead.mockClear();
    mocks.notifications = [{ _id: "notice-1", title: "Cancellation requested", message: "Farmer asked to cancel", eventType: "cancellation_requested", metadata: { serviceType: "health", requestId: "507f1f77bcf86cd799439051" }, isRead: false }];
    render(<MemoryRouter initialEntries={["/technician/dashboard"]}><Topbar title="Dashboard" /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));
    fireEvent.click(screen.getByText("Cancellation requested"));
    expect(mocks.markRead).toHaveBeenCalledWith("notice-1");
    expect(screen.getByTestId("location")).toHaveTextContent("/technician/requests?section=myWork&requestId=507f1f77bcf86cd799439051");
  });

  it("retains the existing mark-read behavior for unrelated notifications", () => {
    mocks.markRead.mockClear();
    mocks.notifications = [{ _id: "notice-2", title: "Other update", message: "Update", eventType: "other", metadata: {}, isRead: false }];
    render(<MemoryRouter initialEntries={["/technician/dashboard"]}><Topbar title="Dashboard" /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));
    fireEvent.click(screen.getByText("Other update"));
    expect(mocks.markRead).toHaveBeenCalledWith("notice-2");
    expect(screen.getByTestId("location")).toHaveTextContent("/technician/dashboard");
  });
});
