import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import {
  buildPregnancyActionRequest,
  getCalendarTarget,
  getTaskPrimaryActionLabel,
  normalizeTaskContext,
  getTaskActionTarget,
  validateTaskContextForAction,
  sanitizeReturnTo,
  buildTaskNavigationState,
} from "./taskNavigation";
import TaskContextCard from "../features/technician/TaskContextCard";
import TaskContextErrorView from "../features/technician/TaskContextErrorView";

describe("canonical technician task navigation", () => {
  it("routes a linked task by task id without using its title", () => {
    const target = getCalendarTarget({
      task: "Any presentation title",
      taskId: "task-22",
      metadata: { workflowStage: "continuation_recheck" },
    });
    expect(target).toMatchObject({
      kind: "task",
      path: "/technician/work-queue",
      search: "?taskId=task-22",
    });
  });

  it("routes a standalone request to Request Board", () => {
    expect(getCalendarTarget({ requestId: "request-8" })).toMatchObject({
      kind: "request",
      path: "/technician/requests",
      search: "?requestId=request-8",
    });
  });

  it("uses stage-specific pregnancy actions", () => {
    expect(
      getTaskPrimaryActionLabel({
        taskType: "PD",
        metadata: { workflowStage: "initial_confirmation" },
      }),
    ).toBe("Record pregnancy diagnosis");
    expect(
      getTaskPrimaryActionLabel({
        taskType: "PD",
        metadata: { workflowStage: "continuation_recheck" },
      }),
    ).toBe("Record continuation recheck");
    expect(
      getTaskPrimaryActionLabel({
        taskType: "PD",
        metadata: { workflowStage: "diagnostic_follow_up" },
      }),
    ).toBe("Record diagnostic follow-up");
  });

  it("builds an initial diagnosis payload with method policy context", () => {
    const request = buildPregnancyActionRequest({
      task: {
        _id: "task-1",
        taskType: "PD",
        metadata: { workflowStage: "initial_confirmation" },
        pregnancyReadiness: { policyVersion: "policy-4" },
      },
      animalId: "animal-1",
      inseminationId: "ai-1",
      result: "Pregnant",
      note: "Palpated",
      diagnosisDate: "2026-08-06",
      diagnosticMethod: "palpation",
    });
    expect(request).toEqual({
      url: "/technician/pregnancy-check",
      payload: {
        animalId: "animal-1",
        inseminationId: "ai-1",
        result: "Pregnant",
        technicianNote: "Palpated",
        diagnosisDate: "2026-08-06",
        taskId: "task-1",
        methodCode: "palpation",
        policyVersion: "policy-4",
      },
    });
  });

  it("builds continuation and diagnostic follow-up payloads against the existing Pregnancy", () => {
    for (const workflowStage of [
      "continuation_recheck",
      "diagnostic_follow_up",
    ]) {
      const request = buildPregnancyActionRequest({
        task: {
          _id: "task-2",
          taskType: "PD",
          metadata: { workflowStage, pregnancyId: "preg-1" },
        },
        result: "follow_up_required",
        note: "Review again",
        diagnosisDate: "2026-09-01",
        followUpDate: "2026-09-08",
      });
      expect(request.url).toBe(
        "/technician/pregnancy-checks/preg-1/continuation-recheck",
      );
      expect(request.payload).toMatchObject({
        taskId: "task-2",
        result: "follow_up_required",
        followUpDate: "2026-09-08",
      });
      expect(request.payload).not.toHaveProperty("animalId");
    }
  });

  // --- BATCH 2A-1 EXTENDED UTILITY TESTS ---

  it("normalizes task context correctly and safely", () => {
    const rawTask = {
      _id: "t-100",
      taskType: "AI",
      status: "pending",
      farmerId: { _id: "f-200", name: "seed-john" },
      animalIds: [{ _id: "a-300", earTag: "seed-tag-123", animalId: "a-300" }],
      dueDate: "2026-07-25T12:00:00Z",
      metadata: { pregnancyId: "p-400", sourceType: "request" },
      requestId: "r-500",
    };

    const ctx = normalizeTaskContext(rawTask);
    expect(ctx).toEqual({
      taskId: "t-100",
      taskType: "AI",
      workflowStage: null,
      taskStatus: "pending",
      requestId: "r-500",
      sourceType: "request",
      sourceId: null,
      farmerId: "f-200",
      farmerName: "seed-john",
      animalId: "a-300",
      animalReference: "seed-tag-123",
      dueDate: "2026-07-25T12:00:00Z",
      pregnancyId: "p-400",
      inseminationId: null,
      healthRequestId: null,
      metadata: { pregnancyId: "p-400", sourceType: "request" },
      returnTo: null,
      raw: rawTask,
    });
  });

  it("resolves action targets correctly for dedicated and generic tasks", () => {
    expect(getTaskActionTarget({ taskType: "AI" })).toEqual({
      type: "route",
      path: "/technician/walk-in",
      label: "Record AI Service",
    });

    expect(getTaskActionTarget({ taskType: "Health" })).toEqual({
      type: "route",
      path: "/technician/health",
      label: "Complete Health Assistance",
    });

    expect(getTaskActionTarget({ taskType: "Calving" })).toEqual({
      type: "route",
      path: "/technician/newborns",
      label: "Record Calving",
    });

    expect(getTaskActionTarget({ taskType: "PD" })).toEqual({
      type: "modal",
      path: null,
      label: "Record pregnancy diagnosis",
    });

    expect(getTaskActionTarget({ taskType: "Other" })).toEqual({
      type: "none",
      path: null,
      label: "Complete task",
    });
  });

  it("validates task context for required fields", () => {
    // Valid context
    expect(
      validateTaskContextForAction({
        taskId: "t-1",
        taskType: "AI",
        animalId: "a-1",
        farmerId: "f-1",
      }),
    ).toEqual({ valid: true, errorType: null, message: null });

    // Missing taskId
    expect(
      validateTaskContextForAction({
        taskType: "AI",
        animalId: "a-1",
        farmerId: "f-1",
      }),
    ).toEqual({
      valid: false,
      errorType: "missing_info",
      message:
        "This task does not contain enough information to open the service form.",
    });

    // Missing animalId for AI
    expect(
      validateTaskContextForAction({
        taskId: "t-1",
        taskType: "AI",
        farmerId: "f-1",
      }),
    ).toEqual({
      valid: false,
      errorType: "missing_info",
      message:
        "This task does not contain enough information to open the service form.",
    });

    // Unavailable target
    expect(
      validateTaskContextForAction({
        taskId: "t-1",
        taskType: "Other",
      }),
    ).toEqual({
      valid: false,
      errorType: "unavailable",
      message: "The requested service workflow could not be opened.",
    });
  });

  it("sanitizes returnTo path with whitelist and falls back safely", () => {
    expect(sanitizeReturnTo("/technician/work-queue")).toBe(
      "/technician/work-queue",
    );
    expect(sanitizeReturnTo("/technician/schedule?taskId=123")).toBe(
      "/technician/schedule?taskId=123",
    );
    expect(sanitizeReturnTo("/technician/requests")).toBe(
      "/technician/requests",
    );

    // Invalid / external paths
    expect(sanitizeReturnTo("/admin/dashboard")).toBe("/technician/work-queue");
    expect(sanitizeReturnTo("http://google.com")).toBe(
      "/technician/work-queue",
    );
    expect(sanitizeReturnTo("")).toBe("/technician/work-queue");
    expect(sanitizeReturnTo(null)).toBe("/technician/work-queue");
  });

  it("builds task navigation state correctly", () => {
    const ctx = {
      taskId: "t-1",
      animalId: "a-1",
      farmerId: "f-1",
      requestId: "r-1",
      pregnancyId: "p-1",
    };
    const state = buildTaskNavigationState(ctx, "/technician/requests");
    expect(state).toEqual({
      taskContext: ctx,
      taskId: "t-1",
      animalId: "a-1",
      farmerId: "f-1",
      requestId: "r-1",
      pregnancyId: "p-1",
      returnTo: "/technician/requests",
    });
  });

  // --- BATCH 2A-1 COMPONENT TESTS ---

  it("renders TaskContextCard beautifully and sanitizes test-seed prefixes", () => {
    const ctx = {
      taskType: "AI",
      workflowStage: "continuation_recheck",
      farmerName: "seed-john-doe",
      animalReference: "seed-ilo-102",
      dueDate: "2099-08-06T05:00:00.000Z",
    };

    render(React.createElement(TaskContextCard, { taskContext: ctx }));

    // Verify sanitized displays
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Ilo 102")).toBeInTheDocument();
    expect(screen.getByText("Artificial Insemination")).toBeInTheDocument();
    expect(screen.getByText(/Continuation Recheck/i)).toBeInTheDocument();

    // Verify integration status indicating preview mode
    expect(
      screen.getByText("Preview Mode - Submission Disabled"),
    ).toBeInTheDocument();
    const contextCard = screen.getByRole("note", {
      name: "Task context description",
    });
    expect(contextCard).toHaveClass("bg-primary/10", "text-base-content");
    expect(contextCard.className).not.toMatch(/text-slate|bg-emerald-50/);
  });

  it("names the active TaskContextCard workflow from its real task type", () => {
    render(
      React.createElement(TaskContextCard, {
        mode: "active",
        taskContext: {
          taskType: "PD",
          workflowStage: "diagnostic_follow_up",
        },
      }),
    );

    expect(screen.getByText("Pregnancy Diagnosis workflow")).toBeInTheDocument();
    expect(screen.queryByText("AI Task Workflow")).not.toBeInTheDocument();
  });

  it("renders TaskContextErrorView correctly according to errorType", () => {
    const { rerender } = render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(TaskContextErrorView, {
          errorType: "missing_info",
        }),
      ),
    );
    expect(screen.getByText("Missing task information")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This task does not contain enough information to open the service form.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Return to Work Queue/i }),
    ).toBeInTheDocument();

    rerender(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(TaskContextErrorView, { errorType: "unavailable" }),
      ),
    );
    expect(screen.getByText("Task target unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("The requested service workflow could not be opened."),
    ).toBeInTheDocument();
  });
});

it("resolves the linked AI request from task metadata", () => {
  const context = normalizeTaskContext({
    _id: "task-1",
    taskType: "AI",
    status: "In Progress",
    farmerId: "farmer-1",
    animalIds: ["animal-1"],
    metadata: {
      requestId: "request-1",
      animalId: "animal-1",
    },
  });

  expect(context.requestId).toBe("request-1");
});
