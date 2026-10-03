import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ success: mocks.toastSuccess }),
}));

vi.mock("../../lib/axios", () => ({
  default: { get: mocks.get, post: mocks.post, delete: mocks.delete },
}));

vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title, subtitle }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  ),
}));

vi.mock("../../components/ui/UserAvatar", () => ({
  default: ({ name }) => <span aria-label={`${name} avatar`} />,
}));

vi.mock("../../components/ui/TableNameLink", async () => {
  const { Link } = await import("react-router-dom");
  return {
    default: ({ to, ariaLabel, children }) => (
      <Link to={to} aria-label={ariaLabel}>
        {children}
      </Link>
    ),
  };
});

vi.mock("../../components/dialogs/RegisterFarmerModal", () => ({
  default: ({ isOpen, farmer }) =>
    isOpen ? (
      <div
        role="dialog"
        aria-label={farmer ? "Edit Farmer" : "Register Farmer"}
        data-farmer-id={farmer?._id || ""}
      />
    ) : null,
}));

vi.mock("../../components/dialogs/RegisterLivestockModal", () => ({
  default: ({ isOpen, preSelectedFarmer }) =>
    isOpen ? (
      <div role="dialog" aria-label="Add Animal" data-farmer-id={preSelectedFarmer?._id || ""} />
    ) : null,
}));

import FarmersDirectory from "./FarmersDirectory";

const farmer = {
  _id: "farmer-507f1f77bcf86cd799439011",
  name: "Maria Santos",
  phoneNumber: "09171234567",
  email: "maria@example.test",
  address: {
    barangay: "Poblacion South",
    city: "Oton",
  },
  animalsCount: 3,
  isVerified: false,
  appAccountStatus: "no_app_account",
};

const page = ({ data = [farmer], total = data.length, currentPage = 1 } = {}) => ({
  data: {
    data,
    total,
    page: currentPage,
    limit: 10,
    totalPages: Math.max(1, Math.ceil(total / 10)),
    metrics: {
      farmersFound: total,
      withAnimals: 17,
      noAnimals: 7,
      noAppAccount: 11,
    },
  },
});

const renderDirectory = (initialEntry = "/technician/farmers") => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/technician/farmers" element={<FarmersDirectory />} />
          <Route
            path="/technician/farmers/:id"
            element={<div>Farmer Profile destination</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Technician Farmers directory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(page());
    mocks.post.mockResolvedValue({
      data: { message: "App invitation sent to maria@example.test." },
    });
  });

  it("renders the canonical directory data without analytics or internal metadata", async () => {
    renderDirectory();

    expect(await screen.findByRole("heading", { name: "Farmers" })).toBeTruthy();
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("/user", {
        params: {
          role: "farmer",
          page: 1,
          limit: 10,
          search: undefined,
          barangay: undefined,
        },
      }),
    );

    expect(screen.getAllByText("Maria Santos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Poblacion South").length).toBeGreaterThan(0);
    expect(screen.getAllByText("09171234567").length).toBeGreaterThan(0);
    expect(screen.getByText("3 registered animals")).toBeTruthy();
    expect(screen.queryByText(farmer._id)).toBeNull();
    expect(screen.queryByText("Verified profiles")).toBeNull();
    expect(screen.queryByText("App connected")).toBeNull();
    expect(screen.queryByText("Registered animals")).toBeNull();
    expect(screen.queryByRole("button", { name: /Export/i })).toBeNull();
    expect(screen.queryByLabelText("Filter farmers by municipality")).toBeNull();
    expect(screen.queryByLabelText("Filter farmers by verification")).toBeNull();
    expect(screen.queryByLabelText("Filter farmers by app access")).toBeNull();
  });

  it("sends practical search and Barangay discovery to the backend and resets page one", async () => {
    mocks.get.mockImplementation((_url, config) =>
      Promise.resolve(page({ currentPage: config.params.page })),
    );
    renderDirectory("/technician/farmers?page=2");

    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith("/user", {
        params: expect.objectContaining({ page: 2 }),
      }),
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search farmers" }), {
      target: { value: "Maria" },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter farmers by barangay" }),
      { target: { value: "Poblacion South" } },
    );

    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith("/user", {
        params: {
          role: "farmer",
          page: 1,
          limit: 10,
          search: "Maria",
          barangay: "Poblacion South",
        },
      }),
    );
  });

  it("opens the Farmer Profile and keeps canonical registration and edit entry points", async () => {
    renderDirectory();
    await screen.findAllByText("Maria Santos");

    fireEvent.click(screen.getByRole("link", { name: "Open profile for Maria Santos" }));
    expect(await screen.findByText("Farmer Profile destination")).toBeTruthy();

    mocks.get.mockClear();
    renderDirectory();
    await screen.findAllByText("Maria Santos");
    fireEvent.click(screen.getByRole("button", { name: "Register Farmer" }));
    expect(screen.getByRole("dialog", { name: "Register Farmer" })).toBeTruthy();

    renderDirectory();
    await screen.findAllByText("Maria Santos");
    fireEvent.click(
      screen.getAllByRole("menuitem", { name: "Edit Farmer", hidden: true })[0],
    );
    expect(screen.getByRole("dialog", { name: "Edit Farmer" })).toHaveAttribute(
      "data-farmer-id",
      farmer._id,
    );
  });

  it("uses authoritative backend totals and pagination", async () => {
    mocks.get.mockImplementation((_url, config) =>
      Promise.resolve(page({ total: 21, currentPage: config.params.page })),
    );
    renderDirectory();

    expect(await screen.findByText("21 farmers")).toBeTruthy();
    expect(screen.getByText("Showing 1–10 of 21")).toBeTruthy();
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next farmers page" }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenLastCalledWith("/user", {
        params: expect.objectContaining({ page: 2 }),
      }),
    );
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
    expect(screen.getByText("Showing 11–20 of 21")).toBeTruthy();
  });

  it("shows truthful loading, empty, and error states", async () => {
    mocks.get.mockImplementation(() => new Promise(() => {}));
    const loadingView = renderDirectory();
    expect(screen.getByLabelText("Loading farmer directory")).toBeTruthy();
    loadingView.unmount();

    mocks.get.mockResolvedValueOnce(page({ data: [], total: 0 }));
    const emptyView = renderDirectory();
    expect(await screen.findByText("No farmers found")).toBeTruthy();
    emptyView.unmount();

    mocks.get.mockRejectedValueOnce(new Error("Network unavailable"));
    renderDirectory();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network unavailable",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("does not fabricate a zero animal count when the field is missing", async () => {
    mocks.get.mockResolvedValueOnce(
      page({ data: [{ ...farmer, animalsCount: null }] }),
    );
    renderDirectory();

    expect((await screen.findAllByText("Not available")).length).toBeGreaterThan(0);
    expect(screen.queryByText("0 registered animals")).toBeNull();
  });

  it("uses backend aggregate metrics rather than current-page rows", async () => {
    mocks.get.mockResolvedValueOnce(page({ data: [farmer], total: 24 }));
    renderDirectory();

    const metrics = await screen.findByRole("region", { name: "Farmer directory metrics" });
    await waitFor(() => expect(within(metrics).getByText("24")).toBeTruthy());
    expect(within(metrics).getByText("Farmers found")).toBeTruthy();
    expect(within(metrics).getByText("With animals")).toBeTruthy();
    expect(within(metrics).getByText("17")).toBeTruthy();
    expect(within(metrics).getByText("No animals")).toBeTruthy();
    expect(within(metrics).getByText("7")).toBeTruthy();
    expect(within(metrics).getByText("No App Account")).toBeTruthy();
    expect(within(metrics).getByText("11")).toBeTruthy();
  });

  it("shows Barangay and truthful account access states without Clerk internals", async () => {
    mocks.get.mockResolvedValueOnce(
      page({
        data: [
          { ...farmer, _id: "linked", appAccountStatus: "connected", clerkId: "user_private" },
          { ...farmer, _id: "profile", name: "Profile Farmer", appAccountStatus: "profile_only", phoneNumber: "" },
          { ...farmer, _id: "sent", name: "Invited Farmer", appAccountStatus: "invitation_sent" },
          { ...farmer, _id: "expired", name: "Expired Farmer", appAccountStatus: "invitation_expired" },
          { ...farmer, _id: "blocked", name: "Blocked Farmer", appAccountStatus: "blocked" },
        ],
      }),
    );
    renderDirectory();

    expect(await screen.findAllByText("Connected")).not.toHaveLength(0);
    expect(screen.getAllByText("No App Account").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Invitation Sent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Invitation Expired").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Phone not provided").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("columnheader", { name: "Barangay" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Poblacion South").length).toBeGreaterThan(0);
    expect(screen.queryByText("user_private")).toBeNull();
    expect(screen.queryByText("Profile Only")).toBeNull();
    expect(screen.queryByText("Technician-managed")).toBeNull();
    expect(screen.queryByText("pending")).toBeNull();
    expect(screen.queryByText("revoked")).toBeNull();
  });

  it("uses compact Farmer action menus instead of permanent row action buttons", async () => {
    renderDirectory();
    await screen.findAllByText("Maria Santos");

    expect(screen.queryByRole("button", { name: "View Profile" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Maria Santos" })).toBeNull();

    expect(screen.getAllByRole("button", { name: "Actions for Maria Santos" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("menuitem", { name: "View Farmer Profile", hidden: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("menuitem", { name: "Edit Farmer", hidden: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("menuitem", { name: "View Animals", hidden: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("menuitem", { name: "Add Animal", hidden: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("menuitem", { name: "Send Invitation", hidden: true }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("menuitem", { name: /Delete Farmer/i, hidden: true })).toBeNull();
  });

  it("shows Send or Resend only for the appropriate Farmer access state", async () => {
    mocks.get.mockResolvedValueOnce(page({
      data: [
        { ...farmer, _id: "no-account", appAccountStatus: "no_app_account" },
        { ...farmer, _id: "sent", name: "Sent", appAccountStatus: "invitation_sent" },
        { ...farmer, _id: "expired", name: "Expired", appAccountStatus: "invitation_expired" },
        { ...farmer, _id: "connected", name: "Connected Farmer", appAccountStatus: "connected" },
        { ...farmer, _id: "blocked", name: "Blocked Farmer", appAccountStatus: "blocked" },
        { ...farmer, _id: "no-email", name: "No Email", email: "", appAccountStatus: "profile_only" },
      ],
    }));
    renderDirectory();
    await screen.findAllByText("Maria Santos");

    expect(screen.getAllByRole("menuitem", { name: "Send Invitation", hidden: true })).toHaveLength(2);
    expect(screen.getAllByRole("menuitem", { name: "Resend Invitation", hidden: true })).toHaveLength(4);
    expect(screen.getAllByRole("menuitem", { name: "Cancel Invitation", hidden: true })).toHaveLength(2);

  });

  it("confirms cancellation and calls the normalized cancellation endpoint", async () => {
    mocks.get.mockResolvedValueOnce(page({
      data: [{ ...farmer, appAccountStatus: "invitation_sent" }],
    }));
    mocks.delete.mockResolvedValueOnce({
      data: { message: "Invitation cancelled.", appAccountStatus: "no_app_account" },
    });
    renderDirectory();
    await screen.findAllByText("Invitation Sent");

    fireEvent.click(screen.getAllByRole("menuitem", { name: "Cancel Invitation", hidden: true })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Cancel invitation?" });
    expect(within(dialog).getByText(/current invitation link will stop working/i)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Keep Invitation" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel Invitation" }));

    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith(
      `/user/${farmer._id}/app-invitation`,
    ));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Invitation cancelled successfully.");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findAllByText("No App Account")).not.toHaveLength(0);
    expect(screen.getAllByRole("menuitem", { name: "Send Invitation", hidden: true }).length).toBeGreaterThan(0);
  });

  it("keeps the invitation when the confirmation is dismissed", async () => {
    mocks.get.mockResolvedValueOnce(page({
      data: [{ ...farmer, appAccountStatus: "invitation_sent" }],
    }));
    renderDirectory();
    await screen.findAllByText("Invitation Sent");
    fireEvent.click(screen.getAllByRole("menuitem", { name: "Cancel Invitation", hidden: true })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Cancel invitation?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep Invitation" }));

    expect(screen.queryByRole("dialog", { name: "Cancel invitation?" })).toBeNull();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("sends and resends through normalized backend endpoints", async () => {
    renderDirectory();
    await screen.findAllByText("Maria Santos");
    fireEvent.click(screen.getAllByRole("menuitem", { name: "Send Invitation", hidden: true })[0]);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(
      "/user/" + farmer._id + "/app-invitation",
    ));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Invitation sent successfully.",
    ));
    expect(screen.queryByRole("alert")).toBeNull();

    mocks.get.mockResolvedValue(page({
      data: [{ ...farmer, appAccountStatus: "invitation_expired" }],
    }));
    renderDirectory();
    await screen.findAllByText("Invitation Expired");
    fireEvent.click(screen.getAllByRole("menuitem", { name: "Resend Invitation", hidden: true })[0]);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(
      "/user/" + farmer._id + "/app-invitation/resend",
    ));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Invitation resent successfully.");
  });

  it("keeps cancellation errors in the dialog and does not show a success toast", async () => {
    mocks.get.mockResolvedValueOnce(page({
      data: [{ ...farmer, appAccountStatus: "invitation_sent" }],
    }));
    mocks.delete.mockRejectedValueOnce({
      response: { data: { message: "Clerk could not revoke the invitation." } },
    });
    renderDirectory();
    await screen.findAllByText("Invitation Sent");
    fireEvent.click(screen.getAllByRole("menuitem", { name: "Cancel Invitation", hidden: true })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Cancel invitation?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel Invitation" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Clerk could not revoke the invitation.",
    );
    expect(screen.getByRole("dialog", { name: "Cancel invitation?" })).toBeTruthy();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("shows an understandable invitation failure", async () => {
    mocks.post.mockRejectedValueOnce({
      response: { data: { message: "The invitation service is unavailable." } },
    });
    renderDirectory();
    await screen.findAllByText("Maria Santos");
    fireEvent.click(screen.getAllByRole("menuitem", { name: "Send Invitation", hidden: true })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The invitation service is unavailable.",
    );
  });
});
