export const REQUEST_BOARD_VIEWS = {
  AVAILABLE: "available",
  MINE: "mine",
  HISTORY: "history",
};

export function getInitialRequestBoardView(status = "pending") {
  if (["completed", "declined"].includes(status)) {
    return REQUEST_BOARD_VIEWS.HISTORY;
  }

  if (["scheduled", "in-progress", "in_progress", "all"].includes(status)) {
    return REQUEST_BOARD_VIEWS.MINE;
  }

  return REQUEST_BOARD_VIEWS.AVAILABLE;
}

export function getRequestBoardViewSelection(view, { isAdmin = false } = {}) {
  if (view === REQUEST_BOARD_VIEWS.HISTORY) {
    return {
      status: "completed",
      assignment: isAdmin ? "all" : "mine",
    };
  }

  if (view === REQUEST_BOARD_VIEWS.MINE) {
    return {
      status: isAdmin ? "in-progress" : "all",
      assignment: isAdmin ? "all" : "mine",
    };
  }

  return {
    status: "pending",
    assignment: isAdmin ? "all" : "unassigned",
  };
}

export function getRequestAssigneeId(request = {}) {
  const raw = request.raw || request;
  const assignee = raw.approvedBy || raw.handledBy || raw.technicianId || null;

  return assignee && typeof assignee === "object"
    ? assignee._id || null
    : assignee;
}

export function isActiveRequestAssignedTo(request, technicianId) {
  if (!technicianId) return false;

  const assigneeId = getRequestAssigneeId(request);
  const status = String(request.status || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");
  const isTerminal = [
    "done",
    "completed",
    "resolved",
    "rejected",
    "cancelled",
  ].includes(status);

  return Boolean(
    assigneeId &&
      String(assigneeId) === String(technicianId) &&
      !isTerminal,
  );
}
