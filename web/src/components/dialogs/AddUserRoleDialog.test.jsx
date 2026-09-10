import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AddUserRoleDialog from "./AddUserRoleDialog";

describe("Add User role dialog", () => {
  it("offers only the supported Farmer and Technician workflows", () => {
    const onSelectRole = vi.fn();
    render(
      <AddUserRoleDialog open onClose={vi.fn()} onSelectRole={onSelectRole} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Farmer/ }));
    expect(onSelectRole).toHaveBeenCalledWith("farmer");

    fireEvent.click(screen.getByRole("button", { name: /Technician/ }));
    expect(onSelectRole).toHaveBeenCalledWith("technician");
    expect(screen.queryByRole("button", { name: /Admin/ })).not.toBeInTheDocument();
  });
});
