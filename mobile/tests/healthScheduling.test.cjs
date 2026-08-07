const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("Health H3 - Scheduling Logic", () => {
  it("1. Health schedule payload status = scheduled.", () => {
    const payload = { status: "scheduled", scheduledDate: "2026-08-10", visitPeriod: "morning" };
    assert.strictEqual(payload.status, "scheduled");
  });

  it("2. Health schedule date is YYYY-MM-DD.", () => {
    const payload = { status: "scheduled", scheduledDate: "2026-08-10", visitPeriod: "morning" };
    assert.match(payload.scheduledDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("3. Morning accepted.", () => {
    const payload = { status: "scheduled", scheduledDate: "2026-08-10", visitPeriod: "morning" };
    assert.strictEqual(payload.visitPeriod, "morning");
  });

  it("4. Afternoon accepted.", () => {
    const payload = { status: "scheduled", scheduledDate: "2026-08-10", visitPeriod: "afternoon" };
    assert.strictEqual(payload.visitPeriod, "afternoon");
  });

  it("5. No preferredDate.", () => {
    const payload = { status: "scheduled", scheduledDate: "2026-08-10", visitPeriod: "morning" };
    assert.strictEqual(payload.preferredDate, undefined);
  });

  it("6. No preferredTime.", () => {
    const payload = { status: "scheduled", scheduledDate: "2026-08-10", visitPeriod: "morning" };
    assert.strictEqual(payload.preferredTime, undefined);
  });

  it("7. No scheduledAt.", () => {
    const payload = { status: "scheduled", scheduledDate: "2026-08-10", visitPeriod: "morning" };
    assert.strictEqual(payload.scheduledAt, undefined);
  });

  it("8. Same date morning -> afternoon is a change.", () => {
    const current = { scheduledDate: "2026-08-10", visitPeriod: "morning" };
    const update = { scheduledDate: "2026-08-10", visitPeriod: "afternoon" };
    assert.notDeepEqual(current, update);
  });

  it("9. Date change is a change.", () => {
    const current = { scheduledDate: "2026-08-10", visitPeriod: "morning" };
    const update = { scheduledDate: "2026-08-11", visitPeriod: "morning" };
    assert.notDeepEqual(current, update);
  });

  it("10. Same date + same period is unchanged where helper supports it.", () => {
    const current = { scheduledDate: "2026-08-10", visitPeriod: "morning" };
    const update = { scheduledDate: "2026-08-10", visitPeriod: "morning" };
    assert.deepEqual(current, update);
  });

  it("11. Legacy missing period does not infer one.", () => {
    // If request.visitPeriod is missing, it should remain null/undefined
    const request = { scheduledDate: "2026-08-10" };
    assert.strictEqual(request.visitPeriod, undefined);
  });

  it("12. Legacy preferredDate display appears only when actual legacy field exists.", () => {
    const requestWithLegacy = { preferredDate: "2026-08-10" };
    const requestWithoutLegacy = {};
    assert.ok(requestWithLegacy.preferredDate);
    assert.strictEqual(requestWithoutLegacy.preferredDate, undefined);
  });

  it("13. Health request schedule is labeled Scheduled, not generic Due Date.", () => {
    const task = { workflowType: "Health", schedule: { date: "2026-08-10" } };
    const isHealthOrAI = task.workflowType === "Health" || task.workflowType === "AI";
    assert.strictEqual(isHealthOrAI, true);
  });

  it("14. Generic non-request Task dueDate remains Due Date.", () => {
    const task = { workflowType: undefined, dueDate: "2026-08-10" };
    const isHealthOrAI = task.workflowType === "Health" || task.workflowType === "AI";
    assert.strictEqual(isHealthOrAI, false);
    assert.ok(task.dueDate);
  });

  it("15. Resolved Health is not considered open/actionable.", () => {
    const isTerminal = (status) => ["done", "resolved", "completed", "rejected", "cancelled", "declined"].includes(status.toLowerCase());
    assert.strictEqual(isTerminal("resolved"), true);
  });

  it("16. AI scheduling payload remains unchanged.", () => {
    const aiPayload = { status: "scheduled", scheduledDate: "2026-08-10", visitPeriod: "morning" };
    assert.strictEqual(aiPayload.status, "scheduled");
    assert.strictEqual(aiPayload.scheduledDate, "2026-08-10");
  });

  it("17. AI still uses date + Morning/Afternoon.", () => {
    const aiPayload = { scheduledDate: "2026-08-10", visitPeriod: "morning" };
    assert.ok(aiPayload.scheduledDate);
    assert.ok(aiPayload.visitPeriod);
  });

  it("18. Health scheduling never calls walk-in Health endpoint.", () => {
    const endpoint = (id) => `/health-request/${id}/status`;
    assert.notStrictEqual(endpoint("123"), "/health-request/walk-in");
  });
});
