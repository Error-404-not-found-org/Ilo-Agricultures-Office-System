import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Eye, Trash2 } from "lucide-react";
import RecordActionsMenu from "./RecordActionsMenu";

describe("RecordActionsMenu", () => {
  it("renders trigger button with accessible label", () => {
    render(
      <RecordActionsMenu
        ariaLabel="Actions for 01RD"
        actions={[{ id: "view", label: "View record", onClick: vi.fn() }]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Actions for 01RD" });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  });

  it("returns null when actions array is empty or not provided", () => {
    const { container } = render(<RecordActionsMenu actions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders provided actions in the menu", () => {
    const actions = [
      { id: "view", label: "View record", icon: Eye, onClick: vi.fn() },
      { id: "delete", label: "Void record", icon: Trash2, danger: true, onClick: vi.fn() },
    ];

    render(<RecordActionsMenu actions={actions} />);

    expect(screen.getByRole("menuitem", { name: "View record", hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Void record", hidden: true })).toBeInTheDocument();
  });

  it("fires action callback when clicked", () => {
    const onView = vi.fn();
    const actions = [
      { id: "view", label: "View record", onClick: onView },
    ];

    render(<RecordActionsMenu actions={actions} />);

    const item = screen.getByRole("menuitem", { name: "View record", hidden: true });
    fireEvent.click(item);

    expect(onView).toHaveBeenCalledTimes(1);
  });

  it("does not fire callback when action is disabled", () => {
    const onDelete = vi.fn();
    const actions = [
      { id: "delete", label: "Void record", disabled: true, onClick: onDelete },
    ];

    render(<RecordActionsMenu actions={actions} />);

    const item = screen.getByRole("menuitem", { name: "Void record", hidden: true });
    expect(item).toBeDisabled();
    fireEvent.click(item);

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("applies danger styling when danger is true", () => {
    const actions = [
      { id: "delete", label: "Void record", danger: true, onClick: vi.fn() },
    ];

    render(<RecordActionsMenu actions={actions} />);

    const item = screen.getByRole("menuitem", { name: "Void record", hidden: true });
    expect(item.className).toContain("text-error");
  });

  it("prevents click event from bubbling to parent container or row", () => {
    const parentClickHandler = vi.fn();
    const onView = vi.fn();

    render(
      <div onClick={parentClickHandler}>
        <RecordActionsMenu
          actions={[{ id: "view", label: "View record", onClick: onView }]}
        />
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "More record actions" });
    fireEvent.click(trigger);
    expect(parentClickHandler).not.toHaveBeenCalled();

    const item = screen.getByRole("menuitem", { name: "View record", hidden: true });
    fireEvent.click(item);
    expect(onView).toHaveBeenCalledTimes(1);
    expect(parentClickHandler).not.toHaveBeenCalled();
  });

  it("invokes hidePopover on popover container when action is clicked", () => {
    const hidePopoverSpy = vi.fn();
    const actions = [{ id: "view", label: "View record", onClick: vi.fn() }];

    render(<RecordActionsMenu id="test-rec" actions={actions} />);

    const popoverElem = screen.getByRole("menu", { hidden: true });
    popoverElem.hidePopover = hidePopoverSpy;

    const item = screen.getByRole("menuitem", { name: "View record", hidden: true });
    fireEvent.click(item);

    expect(hidePopoverSpy).toHaveBeenCalled();
  });
});
