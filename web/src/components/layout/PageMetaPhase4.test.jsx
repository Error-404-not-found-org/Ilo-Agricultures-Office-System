import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import PageMeta from "./PageMeta";

describe("Admin Technician PageMeta", () => {
  it.each([
    ["/admin/technicians", "User Management | Admin"],
    ["/admin/technicians/technician-1", "User Details | Admin"],
    ["/admin/users/farmer-1", "User Details | Admin"],
    ["/admin/users?role=technician", "User Management | Admin"],
  ])("uses %s metadata without losing detail context", async (route, title) => {
    render(
      <MemoryRouter initialEntries={[route]}>
        <PageMeta />
      </MemoryRouter>,
    );

    await waitFor(() => expect(document.title).toBe(title));
  });
});
