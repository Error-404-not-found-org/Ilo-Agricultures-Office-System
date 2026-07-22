import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Input from "./Input";
import Modal from "./Modal";
import Select from "./Select";

describe("shared form controls", () => {
  it("associates an Input label, hint, required state, and error semantics", () => {
    const { rerender } = render(
      <Input
        id="contact-number"
        label="Contact number"
        value=""
        onChange={() => {}}
        required
        hint="Use 11 digits."
        placeholder="09123456789"
      />,
    );

    const input = screen.getByLabelText(/Contact number/);
    expect(input).toHaveAttribute("required");
    expect(input).toHaveAttribute("aria-describedby", "contact-number-hint");
    expect(input).toHaveClass("placeholder:text-base-content/60", "focus-visible:outline-primary");

    rerender(
      <Input
        id="contact-number"
        label="Contact number"
        value=""
        onChange={() => {}}
        error="Contact number is required."
      />,
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "contact-number-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Contact number is required.");
  });

  it("associates a Select label and exposes focus and validation states", () => {
    render(
      <Select
        id="animal-species"
        label="Species"
        value=""
        onChange={() => {}}
        options={["Cattle"]}
        error="Select a species."
        required
      />,
    );

    const select = screen.getByLabelText(/Species/);
    expect(select).toHaveAttribute("required");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute("aria-describedby", "animal-species-error");
    expect(select).toHaveClass("focus-visible:outline-primary");
  });
});

describe("shared Modal", () => {
  it("provides labelled dialog semantics and accessible close controls", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Register animal" subtitle="Link an animal to a farmer.">
        Modal content
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Register animal" });
    const descriptionId = dialog.getAttribute("aria-describedby");
    expect(document.getElementById(descriptionId)).toHaveTextContent("Link an animal to a farmer.");

    fireEvent.click(screen.getAllByRole("button", { name: "Close modal" })[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
