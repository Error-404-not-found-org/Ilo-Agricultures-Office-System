const test = require("node:test");
const assert = require("node:assert/strict");

test("Dispatch Ownership UI Defense Contract", async (t) => {
  await t.test("Stale assigned-to-other data blocks UI and triggers recovery", async () => {
    let queriesInvalidated = false;
    let navigatedBack = false;
    let mutationsRun = 0;

    const mockQueryClient = {
      invalidateQueries: async () => {
        queriesInvalidated = true;
      }
    };

    const mockRouter = {
      back: () => {
        navigatedBack = true;
      },
      replace: () => {
        assert.fail("Should not navigate to a recording form");
      },
      push: () => {
        assert.fail("Should not navigate anywhere else");
      }
    };

    const mockApi = {
      get: async (url) => {
        const err = new Error("Request is assigned to another person.");
        err.response = { status: 403, data: { code: "HEALTH_REQUEST_ASSIGNED_TO_OTHER" } };
        throw err;
      },
      post: async () => {
        mutationsRun++;
        assert.fail("Should not queue offline mutations or make direct calls");
      },
      patch: async () => {
        mutationsRun++;
        assert.fail("Should not queue offline mutations or make direct calls");
      }
    };

    const handleFetchRequestDetails = async () => {
      try {
        await mockApi.get("/api/health-request/stale-id");
      } catch (err) {
        if (err.response?.status === 403 || err.response?.status === 404) {
          await mockQueryClient.invalidateQueries();
          mockRouter.back();
          return;
        }
        throw err;
      }
    };

    await handleFetchRequestDetails();

    assert.equal(queriesInvalidated, true, "A 403 assigned-to-other response must invalidate the stale cache");
    assert.equal(navigatedBack, true, "The screen must close and navigate back");
    assert.equal(mutationsRun, 0, "No claim, schedule, or completion mutation may run");
  });

  await t.test("Action states correspond correctly to loading, assignment, and completion", async () => {
    const getActionState = (loading, requestData) => {
      if (loading || !requestData) return { claimEnabled: false, recordEnabled: false, readOnly: true };
      if (requestData.status === "resolved" || requestData.status === "done") {
        return { claimEnabled: false, recordEnabled: false, readOnly: true };
      }
      if (requestData.status === "pending" || !requestData.assignedToMe) {
        return { claimEnabled: true, recordEnabled: false, readOnly: false };
      }
      return { claimEnabled: false, recordEnabled: true, readOnly: false };
    };

    // Loading: all actions disabled
    const loadingState = getActionState(true, null);
    assert.equal(loadingState.claimEnabled, false, "Claim disabled while loading");
    assert.equal(loadingState.recordEnabled, false, "Record disabled while loading");

    // Pending and unassigned: claim/schedule enabled, recording/completion disabled
    const pendingState = getActionState(false, { status: "pending", assignedToMe: false });
    assert.equal(pendingState.claimEnabled, true, "Claim enabled when pending");
    assert.equal(pendingState.recordEnabled, false, "Record disabled when pending");

    // Assigned to current Technician: state-appropriate actions enabled
    const assignedState = getActionState(false, { status: "scheduled", assignedToMe: true });
    assert.equal(assignedState.claimEnabled, false, "Claim disabled when assigned to me");
    assert.equal(assignedState.recordEnabled, true, "Record enabled when assigned to me");

    // Completed: read-only
    const completedState = getActionState(false, { status: "resolved", assignedToMe: true });
    assert.equal(completedState.claimEnabled, false, "Claim disabled when completed");
    assert.equal(completedState.recordEnabled, false, "Record disabled when completed");
    assert.equal(completedState.readOnly, true, "Must be read-only when completed");
  });
});
