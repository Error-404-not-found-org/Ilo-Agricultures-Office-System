import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "../../lib/axios";
import Livestock from "./Livestock";
import Inseminations from "./Inseminations";

vi.mock("../../lib/axios", () => ({ default: { get: vi.fn() } }));
vi.mock("../../components/layout/Topbar", () => ({
  default: ({ title }) => <header><h1>{title}</h1></header>,
}));

const renderPage = (page) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("admin registry table navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses an accessible livestock profile link without fabricating missing fields", async () => {
    axiosInstance.get.mockResolvedValue({
      data: {
        data: [{
          _id: "animal-1",
          earTag: "ILO-101",
          reproductiveStatus: "Normal",
          farmerId: { name: "Maria Farmer" },
        }],
        total: 1,
        totalPages: 1,
      },
    });

    renderPage(<Livestock />);

    const link = await screen.findByRole("link", {
      name: "Open livestock profile for animal ILO-101",
    });
    expect(link).toHaveAttribute("href", "/admin/livestock/animal-1");
    const table = screen.getByRole("table", { name: "Municipal livestock registry" });
    expect(table).toHaveTextContent("Not recorded");
    expect(table).not.toHaveTextContent("Crossbreed");
    expect(table).not.toHaveTextContent("Beef Cattle");
  });

  it("links insemination animals and never substitutes a fabricated technician or estrus value", async () => {
    axiosInstance.get.mockResolvedValue({
      data: {
        data: [{
          _id: "insemination-1",
          createdAt: "2026-07-22T02:00:00.000Z",
          animalId: { _id: "animal-2", earTag: "ILO-202" },
          farmerId: { name: "Elena Farmer" },
          outcome: "Pending",
        }],
        total: 1,
        totalPages: 1,
      },
    });

    renderPage(<Inseminations />);

    const link = await screen.findByRole("link", {
      name: "Open livestock profile for animal ILO-202",
    });
    expect(link).toHaveAttribute("href", "/admin/livestock/animal-2");
    const table = screen.getByRole("table", { name: "Municipal insemination records" });
    await waitFor(() => expect(table).toHaveTextContent("Not recorded"));
    expect(document.body).not.toHaveTextContent("Juan dela Cruz");
    expect(table).not.toHaveTextContent("Natural");
  });
});
