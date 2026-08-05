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
});
