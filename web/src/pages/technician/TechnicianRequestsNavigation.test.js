import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(path, "utf8");

describe("Technician Requests and My Work navigation", () => {
  it("uses one Requests destination with Available and My Work sections", () => {
    const requests = read("src/pages/technician/Requests.jsx");

    expect(requests).toContain('AVAILABLE: "available"');
    expect(requests).toContain('MY_WORK: "myWork"');
    expect(requests).toContain('aria-label="Technician request sections"');
    expect(requests).toContain("<WorkQueue embedded />");
    expect(requests).not.toContain('aria-label="Request ownership"');
  });

  it("keeps canonical active My Work state and server-side pagination", () => {
    const workQueue = read("src/pages/technician/WorkQueue.jsx");
    const requests = read("src/pages/technician/Requests.jsx");

    expect(workQueue).toContain('axiosInstance.get("/technician/work-queue"');
    expect(workQueue).toContain('workState: "active"');
    expect(workQueue).toContain("page: currentPage");
    expect(workQueue).not.toContain('label: "Active"');
    expect(workQueue).not.toContain('label: "Completed"');
    expect(workQueue).not.toContain('next.set("workState"');
    expect(requests).toContain("View completed records");
    expect(requests).toContain('to="/technician/records"');
  });

  it("redirects the legacy route and removes the duplicate sidebar item", () => {
    const app = read("src/App.jsx");
    const sidebar = read("src/components/layout/Sidebar.jsx");

    expect(app).toContain("function LegacyTechnicianWorkQueueRedirect()");
    expect(app).toContain('params.set("section", "myWork")');
    expect(app).toContain('params.delete("workState")');
    expect(app).toContain("<LegacyTechnicianWorkQueueRedirect />");
    expect(app).toContain(
      '"/technician/requests?section=myWork"',
    );
    expect(sidebar).not.toContain('path: "/technician/work-queue"');
    expect(sidebar).toContain('path: "/technician/requests"');
  });

  it("routes schedule, task recovery, and AI follow-ups into My Work", () => {
    const schedule = read("src/utils/technicianSchedulePresentation.js");
    const taskNavigation = read("src/utils/taskNavigation.js");
    const taskError = read(
      "src/features/technician/TaskContextErrorView.jsx",
    );
    const aiModal = read("src/components/dialogs/AIServiceModal.jsx");

    expect(schedule).toContain('path: "/technician/requests"');
    expect(schedule).toContain("section=myWork");
    expect(taskNavigation).toContain(
      'CANONICAL_MY_WORK_PATH = "/technician/requests?section=myWork"',
    );
    expect(taskError).toContain('"/technician/requests?section=myWork"');
    expect(aiModal).toContain("/technician/requests?section=myWork&taskId=");
  });
});
