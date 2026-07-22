import { describe, expect, it } from "vitest";
import {
  REQUEST_BOARD_VIEWS,
  getInitialRequestBoardView,
  getRequestAssigneeId,
  getRequestBoardViewSelection,
  isActiveRequestAssignedTo,
} from "./requestBoardViews";

describe("request board primary views", () => {
  it("maps existing status links to the matching simplified view", () => {
    expect(getInitialRequestBoardView("pending")).toBe(
      REQUEST_BOARD_VIEWS.AVAILABLE,
    );
    expect(getInitialRequestBoardView("scheduled")).toBe(
      REQUEST_BOARD_VIEWS.MINE,
    );
    expect(getInitialRequestBoardView("completed")).toBe(
      REQUEST_BOARD_VIEWS.HISTORY,
    );
    expect(getInitialRequestBoardView("declined")).toBe(
      REQUEST_BOARD_VIEWS.HISTORY,
    );
  });

  it("uses technician-safe assignment filters", () => {
    expect(getRequestBoardViewSelection(REQUEST_BOARD_VIEWS.AVAILABLE)).toEqual(
      { status: "pending", assignment: "unassigned" },
    );
    expect(getRequestBoardViewSelection(REQUEST_BOARD_VIEWS.MINE)).toEqual({
      status: "all",
      assignment: "mine",
    });
    expect(getRequestBoardViewSelection(REQUEST_BOARD_VIEWS.HISTORY)).toEqual({
      status: "completed",
      assignment: "mine",
    });
  });

  it("uses monitoring-oriented filters for administrators", () => {
    expect(
      getRequestBoardViewSelection(REQUEST_BOARD_VIEWS.AVAILABLE, {
        isAdmin: true,
      }),
    ).toEqual({ status: "pending", assignment: "all" });
    expect(
      getRequestBoardViewSelection(REQUEST_BOARD_VIEWS.MINE, { isAdmin: true }),
    ).toEqual({ status: "in-progress", assignment: "all" });
  });

  it("reads technician assignments from normalized raw request records", () => {
    expect(
      getRequestAssigneeId({ raw: { handledBy: { _id: "tech-health" } } }),
    ).toBe("tech-health");
    expect(
      getRequestAssigneeId({ raw: { approvedBy: "tech-ai" } }),
    ).toBe("tech-ai");
    expect(
      getRequestAssigneeId({ raw: { technicianId: { _id: "tech-pd" } } }),
    ).toBe("tech-pd");
  });

  it("includes assigned pending work and excludes terminal requests", () => {
    expect(
      isActiveRequestAssignedTo(
        { status: "Pending", raw: { technicianId: "tech-1" } },
        "tech-1",
      ),
    ).toBe(true);
    expect(
      isActiveRequestAssignedTo(
        { status: "resolved", raw: { handledBy: "tech-1" } },
        "tech-1",
      ),
    ).toBe(false);
    expect(
      isActiveRequestAssignedTo(
        { status: "scheduled", raw: { approvedBy: "tech-2" } },
        "tech-1",
      ),
    ).toBe(false);
  });
});
