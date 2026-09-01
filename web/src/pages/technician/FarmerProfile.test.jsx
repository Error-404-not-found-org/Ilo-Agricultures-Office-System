import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../lib/axios", () => ({
  default: { get: mocks.get },
}));

vi.mock("../../components/dialogs/RegisterFarmerModal", () => ({
  default: ({ isOpen, farmer }) =>
    isOpen ? <div data-testid="edit-farmer-modal">{farmer?._id}</div> : null,
}));

vi.mock("../../components/dialogs/RegisterLivestockModal", () => ({
  default: ({ isOpen, preSelectedFarmer }) =>
    isOpen ? (
      <div data-testid="register-animal-modal">{preSelectedFarmer?._id}</div>
    ) : null,
}));

vi.mock("../../components/dialogs/AIServiceModal", () => ({
  default: ({ isOpen, preSelectedFarmer, context }) =>
    isOpen ? (
      <div data-testid="ai-service-modal">
        {preSelectedFarmer?._id} · {context} · Record AI Now · Add Past Record
      </div>
    ) : null,
}));

vi.mock("../../components/dialogs/WalkInHealthModal", () => ({
  default: ({ isOpen, preSelectedFarmer, existingOnly }) =>
    isOpen ? (
      <div data-testid="health-service-modal">
        {preSelectedFarmer?._id} · {existingOnly ? "existing" : "manual"}
      </div>
    ) : null,
}));

import FarmerProfile from "./FarmerProfile";

const farmerId = "507f1f77bcf86cd799439010";
const animalId = "507f1f77bcf86cd799439020";

const farmer = {
  _id: farmerId,
  name: "Maria Santos",
  phoneNumber: "09171234567",
  email: "maria@example.test",
  address: { barangay: "San Roque", city: "Oton", province: "Iloilo" },
  profileClaimStatus: "claimed",
  createdAt: "2025-02-03T00:00:00.000Z",
  serviceHistory: [
    {
      _id: "ai-history-1",
      type: "ai",
      entryMode: "history_only",
      inseminationDate: "2025-04-03T01:15:00.000Z",
      animalId: { _id: animalId, earTag: "EAR-17" },
    },
    {
      _id: "health-history-1",
      type: "health",
      handlingMethod: "office_pickup",
      resolvedAt: "2025-05-03T01:15:00.000Z",
      animalId: { _id: animalId, earTag: "EAR-17" },
    },
  ],
};

const animal = {
  _id: animalId,
  farmerId,
  earTag: "EAR-17",
  species: "Cattle",
  breed: "Holstein",
  gender: "Female",
  reproductiveStatus: "Normal",
};

const renderProfile = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <MemoryRouter initialEntries={[`/technician/farmers/${farmerId}`]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/technician/farmers/:id" element={<FarmerProfile />} />
          <Route path="/technician/animals/:id" element={<div>Animal details</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe("Technician Farmer Profile", () => {
  beforeEach(() => mocks.get.mockReset());

  it("shows authoritative identity, owned animals, recent activity, and canonical actions", async () => {
    mocks.get.mockImplementation(async (url) => {
      if (url === `/user/${farmerId}`) return { data: farmer };
      if (url === `/animals/farmer/${farmerId}`) return { data: [animal] };
      return { data: [] };
    });

    renderProfile();

    expect(await screen.findByText("Maria Santos")).toBeVisible();
    expect(screen.getByText("San Roque, Oton, Iloilo")).toBeVisible();
    expect(screen.getByRole("link", { name: "09171234567" })).toHaveAttribute(
      "href",
      "tel:09171234567",
    );
    expect(screen.getAllByText("#EAR-17").length).toBeGreaterThan(0);
    expect(screen.getByText("Past AI record added")).toBeVisible();
    expect(screen.getByText("Office pickup response sent")).toBeVisible();

    expect(screen.queryByText("Registered animals")).not.toBeInTheDocument();
    expect(screen.queryByText("Cattle", { selector: ".stat-title" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pregnant", { selector: ".stat-title" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pregnancy/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /calving/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/record walk-in ai/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Register Animal" }));
    expect(screen.getByTestId("register-animal-modal")).toHaveTextContent(farmerId);

    fireEvent.click(screen.getByRole("button", { name: "Edit Farmer" }));
    expect(screen.getByTestId("edit-farmer-modal")).toHaveTextContent(farmerId);

    fireEvent.click(screen.getByRole("button", { name: /^Record AI Service/ }));
    expect(screen.getByTestId("ai-service-modal")).toHaveTextContent(
      `${farmerId} · walk-in · Record AI Now · Add Past Record`,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^Record Health Assistance/ }),
    );
    expect(screen.getByTestId("health-service-modal")).toHaveTextContent(
      `${farmerId} · existing`,
    );

    expect(mocks.get).toHaveBeenCalledWith(`/user/${farmerId}`);
    expect(mocks.get).toHaveBeenCalledWith(`/animals/farmer/${farmerId}`);
  });

  it("shows useful empty states when the Farmer has no animals or activity", async () => {
    mocks.get.mockImplementation(async (url) => {
      if (url === `/user/${farmerId}`) {
        return { data: { ...farmer, serviceHistory: [] } };
      }
      if (url === `/animals/farmer/${farmerId}`) return { data: [] };
      return { data: [] };
    });

    renderProfile();

    expect(await screen.findByText("No animals registered")).toBeVisible();
    expect(screen.getByText("No recent activity")).toBeVisible();
  });

  it("shows a recoverable profile error", async () => {
    mocks.get.mockImplementation(async (url) => {
      if (url === `/user/${farmerId}`) {
        throw { response: { data: { message: "Farmer not found." } } };
      }
      if (url === `/animals/farmer/${farmerId}`) return { data: [] };
      return { data: [] };
    });

    renderProfile();

    expect(await screen.findByText("Farmer profile could not be loaded.")).toBeVisible();
    expect(screen.getByText("Farmer not found.")).toBeVisible();
    expect(screen.getByRole("button", { name: /retry/i })).toBeVisible();
  });
});
