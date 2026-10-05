import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import RegisterFarmerModal from "./RegisterFarmerModal";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("../../lib/axios", () => ({ default: { post: vi.fn(), patch: vi.fn() } }));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => toast }));

function renderModal(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RegisterFarmerModal
        isOpen
        onClose={vi.fn()}
        createEndpoint="/admin/create-user"
        createRole="farmer"
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("Admin assisted Farmer creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosInstance.post.mockResolvedValue({ data: { user: { _id: "farmer-new" } } });
  });

  it("uses the existing Admin Farmer contract and refresh callback", async () => {
    const onSuccess = vi.fn();
    renderModal({ onSuccess });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /First name/ })).toHaveValue("");
    });

    fireEvent.change(screen.getByRole("textbox", { name: /First name/ }), { target: { value: "Maria" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Last name/ }), { target: { value: "Santos" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Contact number/ }), { target: { value: "09171234567" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Barangay/ }), { target: { value: "Poblacion South" } });
    fireEvent.submit(document.getElementById("register-farmer-form"));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith("/admin/create-user", {
        firstName: "Maria",
        lastName: "Santos",
        phoneNumber: "09171234567",
        email: "",
        barangay: "Poblacion South",
        city: "Oton",
        province: "Iloilo",
        role: "farmer",
        address: {
          barangay: "Poblacion South",
          city: "Oton",
          province: "Iloilo",
        },
      });
    });
    expect(onSuccess).toHaveBeenCalledWith({ _id: "farmer-new" });
  });

  it("keeps validation and reports backend failures truthfully", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /First name/ })).toHaveValue("");
    });
    fireEvent.submit(document.getElementById("register-farmer-form"));
    expect(screen.getByRole("alert")).toHaveTextContent("First name is required.");
    expect(toast.error).not.toHaveBeenCalled();
    expect(axiosInstance.post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: /First name/ }), { target: { value: "Maria" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Last name/ }), { target: { value: "Santos" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Contact number/ }), { target: { value: "09171234567" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Barangay/ }), { target: { value: "Poblacion South" } });
    axiosInstance.post.mockRejectedValueOnce({
      response: { data: { message: "Farmer email is already claimed." } },
    });
    fireEvent.submit(document.getElementById("register-farmer-form"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Farmer email is already claimed.");
      expect(screen.getByRole("textbox", { name: /Email address/ })).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("textbox", { name: /Email address/ })).toHaveClass("input-error");
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("keeps a failed registration open, clears its error on correction, and permits retry", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    renderModal({ onClose, onSuccess });

    await waitFor(() => expect(screen.getByRole("textbox", { name: /First name/ })).toHaveValue(""));
    fireEvent.change(screen.getByRole("textbox", { name: /First name/ }), { target: { value: "Maria" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Last name/ }), { target: { value: "Santos" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Barangay/ }), { target: { value: "Poblacion South" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Email address/ }), { target: { value: "taken@example.test" } });
    axiosInstance.post.mockRejectedValueOnce({ response: { data: { message: "Farmer email is already claimed." } } });
    fireEvent.submit(document.getElementById("register-farmer-form"));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Farmer email is already claimed."));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: /Email address/ })).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(screen.getByRole("textbox", { name: /Email address/ }), { target: { value: "available@example.test" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Save Farmer/ })).not.toBeDisabled());
    fireEvent.submit(document.getElementById("register-farmer-form"));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledTimes(2);
      expect(axiosInstance.post.mock.calls[1][1].email).toBe("available@example.test");
      expect(onSuccess).toHaveBeenCalledWith({ _id: "farmer-new" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("does not carry a failed registration error into the next opening", async () => {
    const onClose = vi.fn();
    const queryClient = new QueryClient();
    const modal = (isOpen) => (
      <QueryClientProvider client={queryClient}>
        <RegisterFarmerModal isOpen={isOpen} onClose={onClose} createEndpoint="/admin/create-user" createRole="farmer" />
      </QueryClientProvider>
    );
    const { rerender } = render(modal(true));
    fireEvent.submit(document.getElementById("register-farmer-form"));
    expect(screen.getByRole("alert")).toHaveTextContent("First name is required.");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(modal(false));
    rerender(modal(true));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("allows a blank optional phone and omits it from the assisted Farmer payload", async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /First name/ })).toHaveValue("");
    });
    fireEvent.change(screen.getByRole("textbox", { name: /First name/ }), { target: { value: "Maria" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Last name/ }), { target: { value: "Santos" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Barangay/ }), { target: { value: "Poblacion South" } });
    fireEvent.submit(document.getElementById("register-farmer-form"));

    await waitFor(() => {
      const [, payload] = axiosInstance.post.mock.calls[0];
      expect(payload).not.toHaveProperty("phoneNumber");
      expect(payload.address).not.toHaveProperty("phoneNumber");
    });
  });

  it("still blocks an invalid nonblank phone", async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /First name/ })).toHaveValue("");
    });
    fireEvent.change(screen.getByRole("textbox", { name: /First name/ }), { target: { value: "Maria" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Last name/ }), { target: { value: "Santos" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Contact number/ }), { target: { value: "0917" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Barangay/ }), { target: { value: "Poblacion South" } });
    fireEvent.submit(document.getElementById("register-farmer-form"));

    expect(screen.getByRole("alert")).toHaveTextContent("Phone number must be exactly 11 digits.");
    expect(toast.error).not.toHaveBeenCalled();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it("reviews a possible duplicate and creates separately only after explicit confirmation", async () => {
    const onViewExistingFarmer = vi.fn();
    axiosInstance.post.mockRejectedValueOnce({ response: { status: 409, data: {
      code: "POSSIBLE_DUPLICATE_FARMER",
      possibleMatches: [{ id: "farmer-existing", name: "Nelmar Buenafe", barangay: "Abilay Sur", maskedPhone: "•••• 1231" }],
    } } });
    renderModal({ onViewExistingFarmer });
    await waitFor(() => expect(screen.getByRole("textbox", { name: /First name/ })).toHaveValue(""));
    fireEvent.change(screen.getByRole("textbox", { name: /First name/ }), { target: { value: "Nelmar" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Last name/ }), { target: { value: "Buenafe" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Barangay/ }), { target: { value: "Abilay Sur" } });
    fireEvent.submit(document.getElementById("register-farmer-form"));

    expect(await screen.findByText("Possible existing Farmer found")).toBeInTheDocument();
    expect(screen.getByText("•••• 1231")).toBeInTheDocument();
    expect(axiosInstance.post).toHaveBeenCalledTimes(1);
    expect(axiosInstance.post.mock.calls[0][1]).not.toHaveProperty("confirmSeparateFarmer");
    fireEvent.click(screen.getByRole("button", { name: "Create Separate Farmer" }));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledTimes(2));
    expect(axiosInstance.post.mock.calls[1][1].confirmSeparateFarmer).toBe(true);
    expect(onViewExistingFarmer).not.toHaveBeenCalled();
  });

  it("opens a possible existing Farmer without submitting an override", async () => {
    const onViewExistingFarmer = vi.fn();
    axiosInstance.post.mockRejectedValueOnce({ response: { status: 409, data: {
      code: "POSSIBLE_DUPLICATE_FARMER",
      possibleMatches: [{ id: "farmer-existing", name: "Nelmar Buenafe", barangay: "Abilay Sur" }],
    } } });
    renderModal({ onViewExistingFarmer });
    await waitFor(() => expect(screen.getByRole("textbox", { name: /First name/ })).toHaveValue(""));
    fireEvent.change(screen.getByRole("textbox", { name: /First name/ }), { target: { value: "Nelmar" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Last name/ }), { target: { value: "Buenafe" } });
    fireEvent.change(screen.getByRole("combobox", { name: /Barangay/ }), { target: { value: "Abilay Sur" } });
    fireEvent.submit(document.getElementById("register-farmer-form"));
    fireEvent.click(await screen.findByRole("button", { name: "View Existing Farmer" }));
    expect(onViewExistingFarmer).toHaveBeenCalledWith("farmer-existing");
    expect(axiosInstance.post).toHaveBeenCalledTimes(1);
  });

  it("disables email editing when farmer has a connected or blocked app account", async () => {
    renderModal({
      farmer: {
        _id: "farmer-connected",
        name: "Maria Santos",
        contact: "09171234567",
        email: "maria@example.com",
        appAccountStatus: "connected",
        address: { city: "Oton", barangay: "Poblacion South", province: "Iloilo" },
      },
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Email address \(read-only\)/ })).toBeDisabled();
    });
    expect(screen.getByText(/Connected or blocked accounts cannot have their email edited here/)).toBeInTheDocument();
  });

  it("permits email editing for unclaimed farmers without an active connected account", async () => {
    renderModal({
      farmer: {
        _id: "farmer-unclaimed",
        name: "Maria Santos",
        contact: "09171234567",
        email: "maria@example.com",
        appAccountStatus: "no_app_account",
        profileClaimStatus: "unclaimed",
        address: { city: "Oton", barangay: "Poblacion South", province: "Iloilo" },
      },
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Email address \(optional\)/ })).not.toBeDisabled();
    });
  });

  it("validates email format before submitting when email is edited", async () => {
    renderModal({
      farmer: {
        _id: "farmer-unclaimed",
        name: "Maria Santos",
        contact: "09171234567",
        email: "",
        appAccountStatus: "no_app_account",
        profileClaimStatus: "unclaimed",
        address: { city: "Oton", barangay: "Poblacion South", province: "Iloilo" },
      },
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Email address \(optional\)/ })).toHaveValue("");
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Email address \(optional\)/ }), {
      target: { value: "not-an-email" },
    });
    fireEvent.submit(document.getElementById("register-farmer-form"));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(axiosInstance.patch).not.toHaveBeenCalled();
  });
});
