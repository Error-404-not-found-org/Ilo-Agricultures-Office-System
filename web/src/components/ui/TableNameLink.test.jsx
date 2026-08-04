import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import TableNameLink from "./TableNameLink";

describe("TableNameLink", () => {
  it("navigates with an accessible link and exposes visible interaction styles", () => {
    render(
      <MemoryRouter initialEntries={["/technician/animals"]}>
        <Routes>
          <Route
            path="/technician/animals"
            element={(
              <TableNameLink
                to="/technician/animals/animal-1"
                ariaLabel="Open livestock profile for animal ILO-001"
              >
                #ILO-001
              </TableNameLink>
            )}
          />
          <Route path="/technician/animals/:id" element={<p>Livestock profile</p>} />
        </Routes>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", {
      name: "Open livestock profile for animal ILO-001",
    });
    expect(link).toHaveAttribute("href", "/technician/animals/animal-1");
    expect(link).toHaveClass("hover:underline", "focus-visible:ring-2");

    fireEvent.click(link);
    expect(screen.getByText("Livestock profile")).toBeInTheDocument();
  });
});
