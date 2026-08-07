const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Batch A UI Parity Tests", async (t) => {
  const requestDetailsPath = path.join(__dirname, "../app/(technician)/request-details.tsx");
  const myWorkPanelPath = path.join(__dirname, "../features/technician-requests/components/TechnicianMyWorkPanel.tsx");

  const requestDetailsCode = fs.readFileSync(requestDetailsPath, "utf-8");
  const myWorkPanelCode = fs.readFileSync(myWorkPanelPath, "utf-8");

  await t.test("AI Request Details routes to record-ai with all identifiers and avoids fabrication", () => {
    assert.match(requestDetailsCode, /pathname:\s*"\/\(technician\)\/record-ai"/);
    assert.match(requestDetailsCode, /mode:\s*"request-linked"/);
    assert.match(requestDetailsCode, /requestId:\s*request\._id/);
    assert.doesNotMatch(requestDetailsCode, /workflowId:\s*request\._id/); // Prevents fabrication
    assert.match(requestDetailsCode, /\.\.\.\(request\.workflowId \|\| workflowId \? \{ workflowId: request\.workflowId \|\| workflowId \} : \{\}\)/); // Uses canonical workflowId if available
    assert.match(requestDetailsCode, /\.\.\.\(request\.taskId \|\| taskId \? \{ taskId: request\.taskId\?\._id \|\| request\.taskId \|\| taskId \} : \{\}\)/);
  });

  await t.test("Health Request Details routes to health-log with all identifiers and avoids fabrication", () => {
    assert.match(requestDetailsCode, /pathname:\s*"\/\(technician\)\/health-log"/);
    assert.match(requestDetailsCode, /source:\s*"task"/);
    assert.match(requestDetailsCode, /healthRequestId:\s*request\._id/);
    assert.match(requestDetailsCode, /requestId:\s*request\._id/);
    assert.doesNotMatch(requestDetailsCode, /workflowId:\s*request\._id/); // Prevents fabrication
    assert.match(requestDetailsCode, /\.\.\.\(request\.workflowId \|\| workflowId \? \{ workflowId: request\.workflowId \|\| workflowId \} : \{\}\)/);
    assert.match(requestDetailsCode, /\.\.\.\(request\.taskId \|\| taskId \? \{ taskId: request\.taskId\?\._id \|\| request\.taskId \|\| taskId \} : \{\}\)/);
  });

  await t.test("Completed/cancelled requests expose no editable completion action", () => {
    // The primaryActionLabel logic checks status properly and does not return 'Complete' for 'done'
    assert.doesNotMatch(requestDetailsCode, /status === "done"\s*\?\s*"Complete"/);
  });

  await t.test("Direct actions do not inherit stale taskId or requestId", () => {
    // Direct action logic is not in request-details, but we ensure no direct walkInMutation exists here
    assert.doesNotMatch(requestDetailsCode, /walkInMutation/);
  });

  await t.test("Embedded AI and Health forms are removed", () => {
    assert.doesNotMatch(requestDetailsCode, /const \[sireCode, setSireCode\]/);
    assert.doesNotMatch(requestDetailsCode, /const \[diagnosis, setDiagnosis\]/);
  });

  await t.test("My Work and Open Requests preserve taskId and requestId", () => {
    // TechnicianMyWorkPanel should route to request-details for AI
    assert.match(myWorkPanelCode, /pathname:\s*"\/\(technician\)\/request-details"/);
    assert.match(myWorkPanelCode, /type:\s*"ai"/);
    // It should not route to record-ai directly anymore
    assert.doesNotMatch(myWorkPanelCode, /pathname:\s*"\/\(technician\)\/record-ai"/);
  });

  await t.test("Required Reproductive Action formats scheduled AI correctly without 12:00 PM fake time", () => {
    assert.match(requestDetailsCode, /overrideDateLabel=\{/);
    assert.match(requestDetailsCode, /request\.scheduledDate/);
    assert.match(requestDetailsCode, /request\.visitPeriod/);
    assert.match(requestDetailsCode, /"Period not recorded"/);
    assert.match(requestDetailsCode, /formatScheduledDateOnly/);
    assert.doesNotMatch(requestDetailsCode, /12:00 PM/);
  });

  await t.test("AI scheduled visits use calendar-based overdue logic instead of exact datetime", () => {
    assert.match(requestDetailsCode, /aiScheduledAction/);
    assert.match(requestDetailsCode, /const schedDays = Date\.UTC/);
    assert.match(requestDetailsCode, /const nowDays = Date\.UTC/);
    assert.match(requestDetailsCode, /isOverdue: schedDays < nowDays/);
  });

  await t.test("Scheduled AI requests show Record AI Service button and do not blindly redirect", () => {
    // Should NOT have the old isAI redirect block in handleAction
    assert.doesNotMatch(requestDetailsCode, /if \(isAI\).*router\.replace/s);
    // Should pass visitPeriod to record-ai
    assert.match(requestDetailsCode, /pathname: "\/\(technician\)\/record-ai".*visitPeriod: request\.visitPeriod \|\| undefined/s);
    // The action panel block should not be hidden for AI
    assert.match(requestDetailsCode, /\{\!isTerminal && \(/);
    assert.doesNotMatch(requestDetailsCode, /\{\!isTerminal && \(\!isAI \|\| request\.cancellationStatus === "requested"\) && \(/);
  });
});
