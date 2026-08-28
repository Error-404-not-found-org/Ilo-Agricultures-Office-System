import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import TechnicianInviteDialog from "./TechnicianInviteDialog";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("../../lib/axios", () => ({ default: { post: vi.fn() } }));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => toast }));

function renderDialog(onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

  render(
    <QueryClientProvider client={queryClient}>
      <TechnicianInviteDialog open onClose={onClose} />
    </QueryClientProvider>,
  );

  return { invalidateQueries, onClose };
}

describe("Technician invitation dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosInstance.post.mockResolvedValue({
      data: { technician: { _id: "technician-new" } },
    });
  });

  it("preserves the canonical invitation payload and API endpoint", async () => {
    const { invalidateQueries, onClose } = renderDialog();

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Reyes" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "ANA@EXAMPLE.COM" },
    });
    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: "09171234567" },
    });
    fireEvent.change(screen.getByLabelText("Barangay"), {
      target: { value: "Poblacion South" },
    });
    fireEvent.change(screen.getByLabelText(/Street or sitio/), {
      target: { value: "Sitio Uno" },
    });
    fireEvent.click(screen.getByLabelText("Artificial Insemination"));
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith("/admin/technicians", {
        firstName: "Ana",
        lastName: "Reyes",
        email: "ana@example.com",
        phoneNumber: "09171234567",
        address: {
          street: "Sitio Uno",
          barangay: "Poblacion South",
          city: "Oton",
          province: "Iloilo",
        },
        serviceMunicipalities: [
          {
            municipalityCode: "0603034000",
            municipalityName: "Oton",
            localityType: "municipality",
            provinceCode: "0603000000",
            provinceName: "Iloilo",
          },
        ],
        serviceCapabilities: ["AI"],
      });
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Invitation email sent successfully to ANA@EXAMPLE.COM!",
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["admin", "technicians-list"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["admin", "users"],
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps existing validation and inline submission error behavior", async () => {
    renderDialog();

    fireEvent.submit(screen.getByRole("dialog").querySelector("form"));
    expect(toast.error).toHaveBeenCalledWith(
      "Please fill in all required fields.",
    );
    expect(axiosInstance.post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Reyes" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: "09171234567" },
    });
    fireEvent.change(screen.getByLabelText("Barangay"), {
      target: { value: "Poblacion South" },
    });
    axiosInstance.post.mockRejectedValueOnce({
      response: { data: { message: "Invitation already exists." } },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invitation already exists.");
    });
  });
});
