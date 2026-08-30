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
    expect(toast.error).toHaveBeenCalledWith("First name is required.");
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
      expect(toast.error).toHaveBeenCalledWith("Farmer email is already claimed.");
    });
  });
});
