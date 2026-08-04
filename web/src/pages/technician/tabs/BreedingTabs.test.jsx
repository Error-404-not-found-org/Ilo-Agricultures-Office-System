import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import InseminationTab from "./InseminationTab";

describe("breeding ledger tables", () => {
  it("uses keyboard-operable sort buttons, aria-sort, links, and an action menu", () => {
    const onSort = vi.fn();
    const onInspect = vi.fn();
    render(
      <MemoryRouter>
        <InseminationTab
          records={[
            {
              id: "record-1",
              _id: "record-1",
              animalId: "animal-1",
              animal: "ILO-101",
              farmer: "Maria Farmer",
              date: "2026-07-22T09:00:00.000Z",
              status: "Completed",
              detail: "Bull A",
              attemptNumber: 1,
            },
          ]}
          sortConfig={{ key: "animal", direction: "asc" }}
          onSort={onSort}
          onInspect={onInspect}
        />
      </MemoryRouter>,
    );

    const table = screen.getByRole("table", { name: "Insemination ledger records" });
    const animalHeader = within(table).getByRole("columnheader", { name: /Animal/ });
    expect(animalHeader).toHaveAttribute("aria-sort", "ascending");

    const sortButton = within(animalHeader).getByRole("button", { name: /Animal/ });
    expect(sortButton).toHaveClass("focus-visible:outline-primary");
    fireEvent.click(sortButton);
    expect(onSort).toHaveBeenCalledWith("animal");

    expect(within(table).getByRole("link", { name: /Open livestock profile/ })).toHaveAttribute(
      "href",
      "/technician/animals/animal-1",
    );
    expect(within(table).getByRole("button", { name: "Actions for record record-1" })).toHaveAttribute(
      "aria-haspopup",
      "menu",
    );
    const actionMenu = document.querySelector("#insemination-ledger-actions-record-1");
    expect(actionMenu).toHaveAttribute("role", "menu");
    expect(actionMenu).toHaveAttribute("aria-label", "Actions for insemination record record-1");
  });
});
