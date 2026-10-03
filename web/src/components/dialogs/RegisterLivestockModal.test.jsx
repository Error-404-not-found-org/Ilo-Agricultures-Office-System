import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import RegisterLivestockModal from "./RegisterLivestockModal";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("../../lib/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock("../../contexts/ToastContext", () => ({ useToast: () => toast }));

async function renderModal(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RegisterLivestockModal isOpen onClose={vi.fn()} {...props} />
    </QueryClientProvider>,
  );

  await waitFor(() => {
    expect(axiosInstance.get).toHaveBeenCalledWith("/user?role=farmer");
  });

  return utils;
}

describe("RegisterLivestockModal - Ear Tag and Generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosInstance.get.mockImplementation(async (url) => {
      if (url === "/user?role=farmer") {
        return {
          data: [
            { _id: "farmer-1", name: "Danilo Perez", phoneNumber: "09171112222" },
            { _id: "farmer-2", name: "Maria Santos", phoneNumber: "09173334444" },
          ],
        };
      }
      if (url.startsWith("/animals/farmer/")) {
        return { data: [] };
      }
      return { data: [] };
    });
  });

  it("warns if Generate Tag is clicked without a selected farmer", async () => {
    await renderModal();

    const generateBtn = screen.getByRole("button", { name: /generate tag/i });
    fireEvent.click(generateBtn);

    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByText("Please select a farmer first.")).toBeInTheDocument();
    expect(screen.queryByText("Please select a farmer before generating an ear tag.")).not.toBeInTheDocument();
  });

  it("generates an ear tag based on farmer initials and sequential animal count", async () => {
    const preSelectedFarmer = {
      _id: "farmer-2",
      name: "Maria Santos",
    };

    await renderModal({ preSelectedFarmer });

    const generateBtn = screen.getByRole("button", { name: /generate tag/i });
    fireEvent.click(generateBtn);

    const earTagInput = screen.getByPlaceholderText("e.g. 01MC or EAR-17");
    expect(earTagInput).toHaveValue("01MS");
    expect(screen.getByText("Suggested ear tag generated.")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("increments sequence if candidate ear tag already exists for the farmer", async () => {
    axiosInstance.get.mockImplementation(async (url) => {
      if (url === "/user?role=farmer") {
        return {
          data: [{ _id: "farmer-1", name: "Danilo Perez", phoneNumber: "09171112222" }],
        };
      }
      if (url === "/animals/farmer/farmer-1") {
        return {
          data: [
            { _id: "animal-1", earTag: "01DP" },
            { _id: "animal-2", earTag: "02DP" },
          ],
        };
      }
      return { data: [] };
    });

    const preSelectedFarmer = {
      _id: "farmer-1",
      name: "Danilo Perez",
    };

    await renderModal({ preSelectedFarmer });

    // Wait for farmer animals query to resolve
    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith("/animals/farmer/farmer-1");
    });

    const generateBtn = screen.getByRole("button", { name: /generate tag/i });
    fireEvent.click(generateBtn);

    const earTagInput = screen.getByPlaceholderText("e.g. 01MC or EAR-17");
    expect(earTagInput).toHaveValue("03DP");
    expect(screen.getByText("Suggested ear tag generated.")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("accepts ear tags longer than 4 characters and reports values over 20 characters", async () => {
    await renderModal();

    const earTagInput = screen.getByPlaceholderText("e.g. 01MC or EAR-17");
    expect(earTagInput).toHaveAttribute("maxLength", "20");
    fireEvent.change(earTagInput, { target: { value: "tag-2026-xyz" } });
    expect(earTagInput).toHaveValue("TAG-2026-XYZ");

    fireEvent.change(earTagInput, { target: { value: "MANUAL-TAG-1234567890" } });
    expect(earTagInput).toHaveValue("MANUAL-TAG-1234567890");
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByText("Ear tag must be 20 characters or fewer.")).toBeInTheDocument();

    fireEvent.change(earTagInput, { target: { value: "100DP" } });
    expect(earTagInput).toHaveValue("100DP");
    expect(screen.queryByText("Ear tag must be 20 characters or fewer.")).not.toBeInTheDocument();
  });

  it("displays inline validation errors when submitting an incomplete form", async () => {
    await renderModal();

    const form = document.getElementById("register-livestock-form");
    fireEvent.submit(form);

    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByText("Please select a livestock owner.")).toBeInTheDocument();
    expect(screen.getByText("Ear tag number is required.")).toBeInTheDocument();
    expect(screen.getByText("Please fill in all required fields marked with an asterisk (*).")).toBeInTheDocument();
  });

  it("displays inline error for invalid image type or oversized image", async () => {
    await renderModal();

    const photoInput = document.getElementById("animal-photo");
    const invalidFile = new File(["dummy content"], "test.pdf", { type: "application/pdf" });
    fireEvent.change(photoInput, { target: { files: [invalidFile] } });

    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByText("Please select a valid image file.")).toBeInTheDocument();

    const hugeFile = new File(["a".repeat(100)], "huge.png", { type: "image/png" });
    Object.defineProperty(hugeFile, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(photoInput, { target: { files: [hugeFile] } });

    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByText("Animal photos must be 5 MB or smaller.")).toBeInTheDocument();

    const validFile = new File(["image"], "animal.png", { type: "image/png" });
    fireEvent.change(photoInput, { target: { files: [validFile] } });
    await waitFor(() => {
      expect(screen.queryByText("Animal photos must be 5 MB or smaller.")).not.toBeInTheDocument();
    });
  });

  it("displays inline form alert and tag error on mutation failure", async () => {
    axiosInstance.post.mockRejectedValueOnce({
      response: {
        data: { message: "Ear tag already exists for this farmer" },
      },
    });

    const preSelectedFarmer = { _id: "farmer-1", name: "Danilo Perez" };
    await renderModal({ preSelectedFarmer });

    fireEvent.change(screen.getByPlaceholderText("e.g. 01MC or EAR-17"), {
      target: { value: "01DP" },
    });
    fireEvent.change(screen.getByLabelText(/genetic breed/i), {
      target: { value: "Brahman" },
    });
    fireEvent.change(screen.getByLabelText(/primary color/i), {
      target: { value: "Brown" },
    });
    fireEvent.change(screen.getByLabelText(/birth date/i), {
      target: { value: "2024-01-01" },
    });

    const form = document.getElementById("register-livestock-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Failed to register livestock: Ear tag already exists/i)).toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("keeps the final registration success notification after closing the modal", async () => {
    axiosInstance.post.mockResolvedValueOnce({ data: { animal: { _id: "animal-1" } } });
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    await renderModal({
      preSelectedFarmer: { _id: "farmer-1", name: "Danilo Perez" },
      onClose,
      onSuccess,
    });

    fireEvent.change(screen.getByPlaceholderText("e.g. 01MC or EAR-17"), { target: { value: "100DP" } });
    fireEvent.change(screen.getByLabelText(/genetic breed/i), { target: { value: "Brahman" } });
    fireEvent.change(screen.getByLabelText(/primary color/i), { target: { value: "Brown" } });
    fireEvent.change(screen.getByLabelText(/birth date/i), { target: { value: "2024-01-01" } });
    fireEvent.submit(document.getElementById("register-livestock-form"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalledWith({ _id: "animal-1" });
    expect(toast.success).toHaveBeenCalledWith("Livestock profile registered successfully!");
  });
});
