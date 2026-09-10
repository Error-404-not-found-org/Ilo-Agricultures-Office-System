import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Profile from "./Profile";

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), patch: vi.fn(), signOut: vi.fn(), openUserProfile: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("../../lib/axios", () => ({ default: mocks }));
vi.mock("@clerk/clerk-react", () => ({ useClerk: () => mocks }));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => mocks }));
vi.mock("../../components/layout/Topbar", () => ({ default: ({ title }) => <div>{title}</div> }));

const fixture = () => ({ _id: "technician-1", name: "Juan Dela Cruz", email: "juan@example.test", phoneNumber: "09123456789", imageUrl: "", address: { street: "Main Street", barangay: "Abilay Norte", city: "Oton", province: "Iloilo", region: "Region VI", zipCode: "5020" }, dispatchProfile: { acceptsNewRequests: true, serviceMunicipalities: [{ municipalityName: "Oton" }], serviceCapabilities: ["AI", "HEALTH"] } });
let profile;
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><Profile /></QueryClientProvider>);
}
async function editor() {
  await screen.findByRole("button", { name: "Edit profile" });
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  return within(screen.getByRole("dialog", { name: "Edit profile" }));
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); profile = fixture();
  mocks.get.mockImplementation(async () => ({ data: profile }));
  mocks.put.mockImplementation(async (_url, payload) => { profile = { ...profile, ...payload }; return { data: { user: profile } }; });
  mocks.patch.mockResolvedValue({ data: { dispatchProfile: { ...profile.dispatchProfile, acceptsNewRequests: false } } });
  mocks.signOut.mockResolvedValue(undefined);
});

describe("Technician Profile consolidation", () => {
  it("shows real identity and coverage without metrics or placeholder settings", async () => {
    mount();
    expect(await screen.findByRole("heading", { name: "Juan Dela Cruz" })).toBeVisible();
    const main = within(screen.getByRole("main"));
    expect(main.getByText("juan@example.test")).toBeVisible();
    expect(main.getByText("Service area: Oton")).toBeVisible();
    expect(main.queryByText(/Rating|Fully Synchronized|SMS Hotspot/)).not.toBeInTheDocument();
    expect(mocks.get.mock.calls.every(([url]) => url === "/technician/profile")).toBe(true);
  });
  it("uses neutral missing values and never derives coverage from contact address", async () => {
    profile = { _id: "technician-1", address: { city: "Oton" } };
    mount();
    expect(await screen.findByRole("heading", { name: "Technician profile" })).toBeVisible();
    expect(screen.queryByText("Service area: Oton")).not.toBeInTheDocument();
    expect(screen.queryByText("FI")).not.toBeInTheDocument();
  });
  it("saves through the existing user endpoint and preserves address metadata", async () => {
    const view = mount(); const form = await editor();
    fireEvent.change(form.getByLabelText("Full name"), { target: { value: "Juan Updated" } });
    fireEvent.change(form.getByLabelText("Phone number"), { target: { value: "09987654321" } });
    fireEvent.click(form.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith("/user/technician-1", expect.objectContaining({ name: "Juan Updated", phoneNumber: "09987654321", email: "juan@example.test", imageUrl: "", address: expect.objectContaining({ city: "Oton", barangay: "Abilay Norte", zipCode: "5020", region: "Region VI" }) })));
    expect(await screen.findByRole("heading", { name: "Juan Updated" })).toBeVisible();
    view.unmount(); mount();
    expect(await screen.findByRole("heading", { name: "Juan Updated" })).toBeVisible();
  });
  it("cancels edits without saving and resets the draft on reopen", async () => {
    mount(); const form = await editor();
    fireEvent.change(form.getByLabelText("Full name"), { target: { value: "Unsaved" } });
    fireEvent.click(form.getByRole("button", { name: "Cancel" }));
    expect(mocks.put).not.toHaveBeenCalled();
    expect((await editor()).getByLabelText("Full name")).toHaveValue("Juan Dela Cruz");
  });
  it("retains the draft and displays an API save failure", async () => {
    mocks.put.mockRejectedValue({ response: { data: { message: "Email is already in use." } } });
    mount(); const form = await editor();
    fireEvent.click(form.getByRole("button", { name: "Save changes" }));
    expect(await form.findByRole("alert")).toHaveTextContent("Email is already in use.");
    expect(form.getByLabelText("Full name")).toHaveValue("Juan Dela Cruz");
  });
  it("prevents duplicate submits and closing while saving", async () => {
    let resolveSave; mocks.put.mockReturnValue(new Promise(resolve => { resolveSave = resolve; }));
    mount(); const form = await editor();
    fireEvent.click(form.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(form.getByRole("button", { name: /Saving/ })).toBeDisabled());
    expect(form.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(form.getByRole("button", { name: "Close modal" }));
    expect(screen.getByRole("dialog", { name: "Edit profile" })).toBeVisible();
    resolveSave({ data: {} });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("persists theme across remounts and responds to external changes", async () => {
    const view = mount(); await screen.findByRole("button", { name: "Edit profile" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Use dark mode" }));
    expect(localStorage.getItem("theme")).toBe("breedsmart-dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "breedsmart-dark");
    view.unmount(); mount(); await screen.findByRole("button", { name: "Edit profile" });
    expect(screen.getByRole("checkbox", { name: "Use dark mode" })).toBeChecked();
    localStorage.setItem("theme", "breedsmart"); fireEvent(window, new Event("theme-change"));
    expect(screen.getByRole("checkbox", { name: "Use dark mode" })).not.toBeChecked();
  });
  it("preserves dispatch persistence without adding capabilities to the payload", async () => {
    mount(); await screen.findByRole("button", { name: "Edit profile" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Accept new farmer requests" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith("/technician/dispatch-status", { acceptsNewRequests: false }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Accept new farmer requests" })).not.toBeChecked());
  });
  it("uses Clerk for account management and sign out", async () => {
    mount(); await screen.findByRole("button", { name: "Edit profile" });
    fireEvent.click(screen.getByRole("button", { name: "Manage account" }));
    expect(mocks.openUserProfile).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
  });
  it("shows a recoverable loading failure", async () => {
    mocks.get.mockRejectedValueOnce(new Error("Connection unavailable")); mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Juan Dela Cruz" })).toBeVisible();
  });
});
