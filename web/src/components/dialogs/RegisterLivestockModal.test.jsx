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

    expect(toast.error).toHaveBeenCalledWith("Please select a farmer first.");
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
    expect(toast.success).toHaveBeenCalledWith("Generated ear tag: 01MS");
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
    expect(toast.success).toHaveBeenCalledWith("Generated ear tag: 03DP");
  });

  it("allows typing ear tag numbers longer than 3 characters and converts to uppercase", async () => {
    await renderModal();

    const earTagInput = screen.getByPlaceholderText("e.g. 01MC or EAR-17");
    expect(earTagInput).toHaveAttribute("maxLength", "20");

    fireEvent.change(earTagInput, { target: { value: "tag-2026-xyz" } });
    expect(earTagInput).toHaveValue("TAG-2026-XYZ");
  });
});

