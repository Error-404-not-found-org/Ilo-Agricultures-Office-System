import { describe, expect, it } from "vitest";
import {
  getDashboardAgendaPresentation,
  summarizeDashboardWork,
} from "./dashboardWorkflow";

const now = new Date("2026-07-22T12:00:00+08:00");

describe("Technician Dashboard workflow presentation", () => {
  it("derives real queue counts instead of substituting request categories", () => {
    const pendingRequests = [
      { id: "ai-1", type: "insemination", status: "pending", animalTag: "A-1" },
      { id: "health-1", type: "health", status: "approved", animalTag: "A-2" },
      { id: "done-1", type: "health", status: "resolved", animalTag: "A-3" },
    ];
    const agenda = [
      {
        id: "ai-1",
        type: "insemination",
        status: "approved",
        displayDate: "2026-07-22T09:00:00+08:00",
        animalTag: "A-1",
      },
      {
        id: "pd-1",
        type: "task",
        taskType: "PD",
        status: "In Progress",
        displayDate: "2026-07-21T09:00:00+08:00",
        animalTag: "A-2",
      },
    ];

    expect(summarizeDashboardWork(pendingRequests, agenda, now)).toEqual({
      activeWorkCount: 3,
      activeRequestCount: 2,
      aiRequestCount: 1,
      healthRequestCount: 1,
      pregnancyFollowUpCount: 1,
      dueTodayCount: 1,
      overdueCount: 1,
      animalsToSeeCount: 2,
    });
  });

  it("uses backend task state and pregnancy workflow metadata in the schedule", () => {
    expect(
      getDashboardAgendaPresentation(
        {
          id: "pd-1",
          type: "task",
          taskType: "PD",
          status: "In Progress",
          displayDate: "2026-07-22T15:00:00+08:00",
          raw: {
            taskType: "PD",
            status: "In Progress",
            technicianId: "tech-1",
            dueDate: "2026-07-22T15:00:00+08:00",
            sourceType: "automatic_pd_followup",
            metadata: { workflowStage: "continuation_recheck" },
          },
        },
        now,
      ),
    ).toMatchObject({
      serviceLabel: "Continuation recheck",
      sourceLabel: "Official diagnosis follow-up",
      nextActionLabel: "Update the existing pregnancy record",
      statusLabel: "In progress",
      statusClass: "badge-info",
      isDueToday: true,
      isOverdue: false,
    });
  });

  it("marks an actual overdue visit as overdue without inventing row-position status", () => {
    expect(
      getDashboardAgendaPresentation(
        {
          id: "health-1",
          type: "health",
          serviceType: "Health Assistance",
          status: "approved",
          displayDate: "2026-07-20T09:00:00+08:00",
          overdue: true,
        },
        now,
      ),
    ).toMatchObject({
      statusLabel: "Overdue",
      statusClass: "badge-error",
      sourceLabel: "Farmer service request",
      isDueToday: false,
      isOverdue: true,
    });
  });
});
