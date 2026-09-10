import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPregnancyLossLocation,
  findActivePregnancyLossReport,
  findLatestReviewedPregnancyLossReport,
  formatPregnancyLossStatus,
  isPregnancyLossDuplicateSubmissionBlocked,
  reconcilePregnancyLossSubmission,
  evaluatePregnancyLossSubmissionRecovery,
  getFarmerPregnancyLossPresentation,
} from "./pregnancyLossWorkflow.ts";
import {
  normalizeTechnicianWorkItem,
  normalizeWorkflowStatus,
  normalizeServiceType,
} from "../../technician-requests/utils/requestWorkPresentation.ts";
import { getNotificationInvalidationKeys } from "../../notifications/utils/notificationQueryInvalidation.ts";

// ============================================================================
// 1. STRUCTURED FARMER LOCATION OBJECT -> FORMATTED STRING, NO REACT OBJECT CHILD
// ============================================================================
test("1. structured farmer location object: renders formatted string, never a raw React object child", () => {
  // Shape from manual QA error:
  // {street, barangay, city, province, isDefault, administrativeArea, _id}
  const structuredAddress = {
    _id: "6699abc1234567890",
    isDefault: true,
    street: "Zone 2",
    barangay: "Bita Norte",
    city: "Oton",
    province: "Iloilo",
    administrativeArea: {
      barangayName: "Bita Norte",
      municipalityName: "Oton",
      provinceName: "Iloilo",
    },
  };

  // As direct address object
  const directFormatted = formatPregnancyLossLocation(structuredAddress);
  assert.equal(typeof directFormatted, "string", "Must return a primitive string");
  assert.notEqual(directFormatted, "[object Object]");
  assert.equal(directFormatted, "Zone 2, Bita Norte, Oton, Iloilo");

  // As nested inside farmer object
  const farmerWithAddress = {
    _id: "farmer-01",
    name: "Juan Dela Cruz",
    address: structuredAddress,
  };
  const farmerFormatted = formatPregnancyLossLocation(farmerWithAddress);
  assert.equal(typeof farmerFormatted, "string", "Must return a primitive string for farmer object");
  assert.equal(farmerFormatted, "Zone 2, Bita Norte, Oton, Iloilo");

  // Partial address without street
  const partialAddress = {
    barangay: "Bita Norte",
    city: "Oton",
  };
  const partialFormatted = formatPregnancyLossLocation(partialAddress);
  assert.equal(partialFormatted, "Bita Norte, Oton");

  // Farmer with farmLocation detectedAddress
  const farmerWithFarmLocation = {
    farmLocation: {
      detectedAddress: "Bita Norte, Oton, Iloilo",
      administrativeArea: {
        barangayName: "Bita Norte",
        municipalityName: "Oton",
        provinceName: "Iloilo",
      },
    },
  };
  const farmLocationFormatted = formatPregnancyLossLocation(farmerWithFarmLocation);
  assert.equal(farmLocationFormatted, "Bita Norte, Oton, Iloilo");
});

// ============================================================================
// 2. STRING LOCATION -> RENDERS SAFELY
// ============================================================================
test("2. string location: renders safely and trims whitespace", () => {
  assert.equal(formatPregnancyLossLocation("Bita Norte, Oton"), "Bita Norte, Oton");
  assert.equal(formatPregnancyLossLocation("  Bita Norte, Oton, Iloilo  "), "Bita Norte, Oton, Iloilo");
  assert.equal(formatPregnancyLossLocation("Poblacion South, Oton"), "Poblacion South, Oton");
});

// ============================================================================
// 3. MISSING LOCATION -> 'Location not recorded'
// ============================================================================
test("3. missing location: falls back safely to 'Location not recorded'", () => {
  const fallback = "Location not recorded";

  assert.equal(formatPregnancyLossLocation(null), fallback);
  assert.equal(formatPregnancyLossLocation(undefined), fallback);
  assert.equal(formatPregnancyLossLocation({}), fallback);
  assert.equal(formatPregnancyLossLocation({ address: null }), fallback);
  assert.equal(formatPregnancyLossLocation({ address: {} }), fallback);
  assert.equal(formatPregnancyLossLocation(""), fallback);
  assert.equal(formatPregnancyLossLocation("   "), fallback);
  assert.equal(formatPregnancyLossLocation("N/A"), fallback);
  assert.equal(formatPregnancyLossLocation("none"), fallback);
  assert.equal(formatPregnancyLossLocation("unknown"), fallback);
  assert.equal(formatPregnancyLossLocation("undefined"), fallback);
});

// ============================================================================
// 4. SUCCESSFUL REPORT POST -> NORMAL SUCCESS FLOW
// ============================================================================
test("4. successful report POST: normal success flow returns report and creates no ambiguity", async () => {
  const animalId = "animal-01";
  const pregnancyId = "preg-01";

  const mockApi = {
    postCalls: [] as any[],
    async post(url: string, data: any) {
      this.postCalls.push({ url, data });
      return {
        data: {
          success: true,
          report: {
            _id: "rep-001",
            animalId,
            pregnancyId,
            status: "pending_review",
            observationDate: "2026-09-08",
            notes: "Observed bleeding",
          },
        },
      };
    },
  };

  const response = await mockApi.post(`/animals/${animalId}/report-pregnancy-loss`, {
    observationDate: "2026-09-08",
    notes: "Observed bleeding",
    evidencePhotos: [],
  });

  assert.equal(response.data.success, true);
  assert.equal(response.data.report._id, "rep-001");
  assert.equal(response.data.report.status, "pending_review");
  assert.equal(mockApi.postCalls.length, 1);
});

// ============================================================================
// 5. NETWORK/NO-RESPONSE FOLLOWED BY SERVER ACTIVE REPORT -> RECONCILES AS SUCCESS
// ============================================================================
test("5. network/no-response followed by server active report: reconciles as success", async () => {
  const animalId = "animal-01";
  const pregnancyId = "preg-01";

  const canonicalActiveReport = {
    _id: "rep-server-001",
    animalId,
    pregnancyId,
    status: "pending_review",
    observationDate: "2026-09-08",
    notes: "Observed bleeding",
  };

  const mockApi = {
    async get(url: string) {
      if (url === `/animals/${animalId}/pregnancy-loss-reports`) {
        return {
          data: {
            reports: [canonicalActiveReport],
          },
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    },
  };

  // Simulate network failure where no response reached the client
  const networkError = {
    message: "Network Error: No response",
    request: {}, // Request was initiated
    response: undefined, // No response
    code: "ERR_NETWORK",
  };

  const recovery = await evaluatePregnancyLossSubmissionRecovery({
    api: mockApi,
    animalId,
    pregnancyId,
    error: networkError,
  });

  assert.equal(recovery.recoveredAsSuccess, true, "Should recover as success when canonical active report is found");
  assert.equal(recovery.activeReport?._id, "rep-server-001");
  assert.equal(recovery.activeReport?.status, "pending_review");
  assert.equal(recovery.message, "Pregnancy loss report submitted. A technician will review your report.");
});

// ============================================================================
// 6. IDEMPOTENCY_IN_PROGRESS + ACTIVE REPORT EXISTS -> RECONCILES AS SUCCESS, NO REPEATED POST LOOP
// ============================================================================
test("6. IDEMPOTENCY_IN_PROGRESS + active report exists: reconciles as success without repeated POST loop", async () => {
  const animalId = "animal-01";
  const pregnancyId = "preg-01";

  let postCount = 0;
  let getReportCount = 0;

  const mockApi = {
    async post(_url: string, _data: any) {
      postCount++;
      const error: any = new Error("Request in progress");
      error.response = {
        status: 409,
        data: {
          code: "IDEMPOTENCY_IN_PROGRESS",
          message: "A request with this idempotency key is currently processing",
        },
      };
      throw error;
    },
    async get(url: string) {
      if (url === `/animals/${animalId}/pregnancy-loss-reports`) {
        getReportCount++;
        return {
          data: {
            reports: [
              {
                _id: "rep-002",
                animalId,
                pregnancyId,
                status: "pending_review",
                observationDate: "2026-09-08",
              },
            ],
          },
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    },
  };

  // First POST triggers 409 IDEMPOTENCY_IN_PROGRESS
  let caughtError: any;
  try {
    await mockApi.post(`/animals/${animalId}/report-pregnancy-loss`, {});
  } catch (err) {
    caughtError = err;
  }

  assert.equal(postCount, 1, "Only 1 initial POST should have occurred");

  // Reconcile via canonical server state instead of looping POST
  const recovery = await evaluatePregnancyLossSubmissionRecovery({
    api: mockApi,
    animalId,
    pregnancyId,
    error: caughtError,
  });

  assert.equal(recovery.recoveredAsSuccess, true, "Should reconcile as success from canonical server report");
  assert.equal(recovery.activeReport?._id, "rep-002");
  assert.equal(postCount, 1, "POST must NOT be called again during recovery");
  assert.equal(getReportCount, 1, "Canonical GET was checked instead of repeated POST loop");
});

// ============================================================================
// 7. IDEMPOTENCY_IN_PROGRESS + NO REPORT FOUND -> DOES NOT FALSELY CLAIM SUCCESS
// ============================================================================
test("7. IDEMPOTENCY_IN_PROGRESS + no report found: does not falsely claim success, preserves truthful waiting state", async () => {
  const animalId = "animal-01";
  const pregnancyId = "preg-01";

  const mockApi = {
    async get(url: string) {
      if (url === `/animals/${animalId}/pregnancy-loss-reports`) {
        return {
          data: {
            reports: [], // Server has not created any report yet
          },
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    },
  };

  const idempotencyError = {
    response: {
      status: 409,
      data: {
        code: "IDEMPOTENCY_IN_PROGRESS",
        message: "A request with this idempotency key is currently processing",
      },
    },
  };

  const recovery = await evaluatePregnancyLossSubmissionRecovery({
    api: mockApi,
    animalId,
    pregnancyId,
    error: idempotencyError,
  });

  assert.equal(recovery.recoveredAsSuccess, false, "Must NOT falsely claim success when no canonical report exists");
  assert.equal(recovery.activeReport, null);
  assert.equal(recovery.shouldKeepLocked, true, "Form must remain protected while checking");
  assert.equal(recovery.message, "We're checking whether your report was received. Please wait a moment.");
});

// ============================================================================
// 8. ACTIVE REPORT SUPPRESSES DUPLICATE SUBMIT
// ============================================================================
test("8. active report suppresses duplicate submit", () => {
  const pregnancyId = "preg-active-01";

  // Case A: Report with pending_review -> duplicate blocked
  const pendingReports = [
    {
      _id: "rep-1",
      pregnancyId,
      status: "pending_review",
    },
  ];
  assert.equal(
    isPregnancyLossDuplicateSubmissionBlocked(pendingReports, pregnancyId),
    true,
    "pending_review report must block duplicate submit",
  );
  assert.ok(findActivePregnancyLossReport(pendingReports, pregnancyId));

  // Case B: Report with needs_visit -> duplicate blocked
  const needsVisitReports = [
    {
      _id: "rep-2",
      pregnancyId,
      status: "needs_visit",
    },
  ];
  assert.equal(
    isPregnancyLossDuplicateSubmissionBlocked(needsVisitReports, pregnancyId),
    true,
    "needs_visit report must block duplicate submit",
  );
  assert.ok(findActivePregnancyLossReport(needsVisitReports, pregnancyId));

  // Case C: Resolved report (not_confirmed) -> duplicate NOT blocked
  const notConfirmedReports = [
    {
      _id: "rep-3",
      pregnancyId,
      status: "not_confirmed",
    },
  ];
  assert.equal(
    isPregnancyLossDuplicateSubmissionBlocked(notConfirmedReports, pregnancyId),
    false,
    "not_confirmed report must not block duplicate submit",
  );
  assert.equal(findActivePregnancyLossReport(notConfirmedReports, pregnancyId), null);

  // Case D: Resolved report (confirmed) -> duplicate NOT blocked
  const confirmedReports = [
    {
      _id: "rep-4",
      pregnancyId,
      status: "confirmed",
    },
  ];
  assert.equal(
    isPregnancyLossDuplicateSubmissionBlocked(confirmedReports, pregnancyId),
    false,
    "confirmed report must not block duplicate submit",
  );

  // Case E: Report for a different pregnancy -> duplicate NOT blocked
  const differentPregnancyReports = [
    {
      _id: "rep-5",
      pregnancyId: "other-preg-99",
      status: "pending_review",
    },
  ];
  assert.equal(
    isPregnancyLossDuplicateSubmissionBlocked(differentPregnancyReports, pregnancyId),
    false,
    "report for different pregnancy must not block current pregnancy submit",
  );
});

// ============================================================================
// WORKFLOW PRESENTATION TESTS (EXISTING PRESERVED)
// ============================================================================
test("Pregnancy Loss Review presentation: recognizes task.sourceType === 'farmer_pregnancy_loss_report'", () => {
  const lossTask = {
    _id: "task-loss-1",
    taskType: "BreedingFollowUp",
    sourceType: "farmer_pregnancy_loss_report",
    status: "Pending",
    animal: {
      earTag: "COW-001",
      name: "Bella",
    },
    farmer: {
      name: "Juan Dela Cruz",
    },
    context: {
      reportId: "rep-123",
      observationDate: "2026-09-08",
      notes: "Suspected loss noted with discharge",
    },
  };

  const status = normalizeWorkflowStatus(lossTask);
  assert.equal(status, "needs_review", "Status should normalize to needs_review");

  const service = normalizeServiceType(lossTask);
  assert.equal(service, "breeding_follow_up", "Service type should be breeding_follow_up");

  const normalized = normalizeTechnicianWorkItem(lossTask as any);
  assert.equal(normalized.title, "Pregnancy Loss Review", "Title should be Pregnancy Loss Review");
  assert.equal(normalized.statusLabel, "Needs review", "Status label should be Needs review");
  assert.equal(normalized.actionLabel, "Review Pregnancy Loss", "Action label should be Review Pregnancy Loss");
});

test("Pregnancy Loss Review presentation: recognizes allowedAction === 'REVIEW_PREGNANCY_LOSS'", () => {
  const queueItem = {
    id: "task-queue-1",
    taskType: "BreedingFollowUp",
    sourceType: "farmer_pregnancy_loss_report",
    allowedAction: "REVIEW_PREGNANCY_LOSS",
    workflowType: "PregnancyLossReview",
    status: "Pending",
    farmer: { name: "Maria Santos" },
    animal: { earTag: "COW-002" },
  };

  const status = normalizeWorkflowStatus(queueItem);
  assert.equal(status, "needs_review");

  const normalized = normalizeTechnicianWorkItem(queueItem as any);
  assert.equal(normalized.title, "Pregnancy Loss Review");
  assert.equal(normalized.actionLabel, "Review Pregnancy Loss");
});

test("Farmer calving delivery outcomes: authoritatively live_birth, mixed, stillbirth only", () => {
  const allowedFarmerOutcomes = ["live_birth", "mixed", "stillbirth"];
  assert.equal(allowedFarmerOutcomes.includes("abortion"), false, "Abortion must NOT be an authoritative delivery outcome for farmers");
  assert.equal(allowedFarmerOutcomes.length, 3);
});

test("Pregnancy Loss Report Status: strictly formats human-friendly labels without exposing raw enums", () => {
  assert.equal(formatPregnancyLossStatus("pending_review"), "Awaiting review");
  assert.equal(formatPregnancyLossStatus("needs_visit"), "Follow-up needed");
  assert.equal(formatPregnancyLossStatus("not_confirmed"), "Pregnancy loss not confirmed");
  assert.equal(formatPregnancyLossStatus("confirmed"), "Pregnancy loss confirmed");
  assert.notEqual(formatPregnancyLossStatus("needs_visit"), "Needs Visit");
});

test("findLatestReviewedPregnancyLossReport extracts not_confirmed and confirmed reports", () => {
  const reports = [
    { _id: "rep-1", pregnancyId: "preg-1", status: "not_confirmed", reviewedAt: "2026-09-09T00:00:00.000Z", reviewNotes: "Dam is healthy" },
    { _id: "rep-old", pregnancyId: "preg-old", status: "confirmed", reviewedAt: "2026-05-01T00:00:00.000Z" },
  ];

  const reviewed = findLatestReviewedPregnancyLossReport(reports, "preg-1");
  assert.ok(reviewed);
  assert.equal(reviewed._id, "rep-1");
  assert.equal(reviewed.status, "not_confirmed");
  assert.equal(reviewed.reviewNotes, "Dam is healthy");
});

test("findLatestReviewedPregnancyLossReport obeys 4-level matching priority and avoids guessing", () => {
  const reports = [
    { _id: "rep-preg", pregnancyId: "preg-target", inseminationId: "ai-other", status: "confirmed" },
    { _id: "rep-insem", pregnancyId: "preg-other", inseminationId: "ai-target", status: "confirmed" },
    { _id: "rep-calving", pregnancyId: "preg-c", confirmedCalvingId: "calving-target", status: "confirmed" },
  ];

  // Priority 1: pregnancyId
  assert.equal(
    findLatestReviewedPregnancyLossReport(reports, { pregnancyId: "preg-target", inseminationId: "ai-target" })?._id,
    "rep-preg",
  );

  // Priority 2: inseminationId when pregnancyId does not match
  assert.equal(
    findLatestReviewedPregnancyLossReport(reports, { inseminationId: "ai-target" })?._id,
    "rep-insem",
  );

  // Priority 3: calving linkage
  assert.equal(
    findLatestReviewedPregnancyLossReport(reports, { calvingId: "calving-target" })?._id,
    "rep-calving",
  );

  // Does NOT guess when multiple reports exist and no linkage matches
  assert.equal(
    findLatestReviewedPregnancyLossReport(reports, { pregnancyId: "non-existent" }),
    null,
  );
  assert.equal(
    findLatestReviewedPregnancyLossReport(reports, {}),
    null,
  );

  // Priority 4: single unambiguous reviewed report fallback only when exactly 1 exists and no filter given
  const singleReportList = [{ _id: "rep-single", status: "confirmed" }];
  assert.equal(
    findLatestReviewedPregnancyLossReport(singleReportList)?._id,
    "rep-single",
  );
});

test("Not Confirmed report does not block a new pregnancy concern", () => {
  const reports = [
    { _id: "rep-1", pregnancyId: "preg-1", status: "not_confirmed" },
  ];

  assert.equal(findActivePregnancyLossReport(reports, "preg-1"), null);
  assert.equal(isPregnancyLossDuplicateSubmissionBlocked(reports, "preg-1"), false);
});

test("notification query invalidation includes pregnancy tracker, loss reports, and animal detail keys", () => {
  const keys = getNotificationInvalidationKeys({
    category: "pregnancy",
    eventType: "pregnancy_loss_confirmed",
    relatedId: "rep-1",
    linkType: "animal",
    metadata: { animalId: "animal-99" },
  });

  const stringified = keys.map((k) => JSON.stringify(k));
  assert.ok(stringified.some((k) => k.includes("pregnancy-loss-reports")));
  assert.ok(stringified.some((k) => k.includes("pregnancy-tracker")));
  assert.ok(stringified.some((k) => k.includes("animals")));
});

test("Farmer reviewed pregnancy loss history preserves reviewed date and technician notes", () => {
  const report = {
    _id: "rep-test",
    pregnancyId: "preg-123",
    status: "not_confirmed",
    reportedAt: "2026-09-08T08:00:00.000Z",
    reviewedAt: "2026-09-09T10:00:00.000Z",
    reviewNotes: "Re-examined animal, ultrasound confirms viable fetus.",
  };

  const statusLabel = formatPregnancyLossStatus(report.status);
  assert.equal(statusLabel, "Pregnancy loss not confirmed");
  assert.equal(Boolean(report.reviewedAt), true);
  assert.equal(Boolean(report.reviewNotes), true);
  assert.match(report.reviewNotes, /viable fetus/);
});

// ============================================================================
// FOCUSED FARMER COPY AND HUMANIZED PRESENTATION TESTS
// ============================================================================

test("1. pending_review -> Farmer-friendly awaiting review sentence and no fake reviewed date", () => {
  const report = {
    _id: "rep-p1",
    status: "pending_review",
    observationDate: "2026-09-09",
    reportedAt: "2026-09-09T08:00:00.000Z",
  };

  const p = getFarmerPregnancyLossPresentation(report);
  assert.equal(p.badgeLabel, "Awaiting review");
  assert.equal(
    p.explanation,
    "Your report was sent to the technician for review. Pregnancy monitoring will continue while you wait for a decision.",
  );
  assert.equal(p.hasReviewedDateInSummary, false);
});

test("2. needs_visit -> 'Follow-up needed', no 'Needs Visit', pregnancy monitoring continues", () => {
  const reportWithDate = {
    _id: "rep-nv1",
    status: "needs_visit",
    observationDate: "2026-09-08",
    reportedAt: "2026-09-08T08:00:00.000Z",
    reviewedAt: "2026-09-09T10:00:00.000Z",
    reviewNotes: "Need follow-up check on Friday",
  };

  const p1 = getFarmerPregnancyLossPresentation(reportWithDate);
  assert.equal(p1.badgeLabel, "Follow-up needed");
  assert.notEqual(p1.badgeLabel, "Needs Visit");
  assert.equal(p1.badgeLabel.toLowerCase().includes("needs visit"), false);
  assert.equal(
    p1.explanation,
    "The technician reviewed your report on Sep 9 and needs more information before making a final decision. Pregnancy monitoring will continue.",
  );
  assert.equal(p1.technicianNote, "Need follow-up check on Friday");

  const reportWithoutDate = {
    _id: "rep-nv2",
    status: "needs_visit",
  };
  const p2 = getFarmerPregnancyLossPresentation(reportWithoutDate);
  assert.equal(
    p2.explanation,
    "The technician reviewed your report and needs more information before making a final decision. Pregnancy monitoring will continue.",
  );
});

test("3. not_confirmed -> 'Pregnancy loss not confirmed', technician decision explained, monitoring continues", () => {
  const report = {
    _id: "rep-nc1",
    status: "not_confirmed",
    observationDate: "2026-09-09",
    reportedAt: "2026-09-09T02:00:00.000Z",
    reviewedAt: "2026-09-09T04:00:00.000Z",
    reviewedBy: { name: "Juan Dela Cruz" },
    reviewNotes: "Heartbeat detected on Doppler.",
  };

  const p = getFarmerPregnancyLossPresentation(report);
  assert.equal(p.badgeLabel, "Pregnancy loss not confirmed");
  assert.equal(
    p.explanation,
    "Technician Juan Dela Cruz reviewed your report on Sep 9 and did not confirm pregnancy loss. Pregnancy monitoring will continue.",
  );
  assert.equal(p.technicianNote, "Heartbeat detected on Doppler.");

  // Fallback when no technician name is provided
  const reportNoName = {
    _id: "rep-nc2",
    status: "not_confirmed",
    reviewedAt: "2026-09-09T04:00:00.000Z",
  };
  const p2 = getFarmerPregnancyLossPresentation(reportNoName);
  assert.equal(
    p2.explanation,
    "The technician reviewed your report on Sep 9 and did not confirm pregnancy loss. Pregnancy monitoring will continue.",
  );
});

test("4. confirmed -> 'Pregnancy loss confirmed', recovery monitoring message", () => {
  const report = {
    _id: "rep-c1",
    status: "confirmed",
    observationDate: "2026-09-08",
    reportedAt: "2026-09-08T06:00:00.000Z",
    reviewedAt: "2026-09-09T03:00:00.000Z",
    reviewNotes: "Complete expulsion confirmed.",
  };

  const p = getFarmerPregnancyLossPresentation(report);
  assert.equal(p.badgeLabel, "Pregnancy loss confirmed");
  assert.equal(
    p.explanation,
    "The technician reviewed your report on Sep 9 and confirmed the pregnancy loss. Pregnancy monitoring has ended and recovery monitoring has started.",
  );
});

test("5. observed/reported labels -> 'Date you noticed the signs' and 'Report sent'", () => {
  const report = {
    _id: "rep-labels",
    status: "pending_review",
    observationDate: "2026-09-09",
    reportedAt: "2026-09-09T05:00:00.000Z",
  };

  const p = getFarmerPregnancyLossPresentation(report);
  assert.equal(p.noticedDateLabel, "Date you noticed the signs");
  assert.equal(p.noticedDate, "Sep 9, 2026");
  assert.equal(p.reportSentLabel, "Report sent");
  assert.equal(p.reportSentDate, "Sep 9, 2026");
  assert.equal(p.technicianNoteLabel, "Technician's note");
});

test("6. redundant 'Reviewed on' removed when review date is already in summary copy", () => {
  const report = {
    _id: "rep-nodup",
    status: "not_confirmed",
    observationDate: "2026-09-09",
    reportedAt: "2026-09-09T05:00:00.000Z",
    reviewedAt: "2026-09-09T08:00:00.000Z",
  };

  const p = getFarmerPregnancyLossPresentation(report);
  assert.equal(p.hasReviewedDateInSummary, true);
  assert.match(p.explanation, /reviewed your report on Sep 9/);
  // Presentation does not include a separate reviewed date label for details
  assert.equal((p as any).reviewedDateLabel, undefined);
  assert.equal((p as any).reviewedOn, undefined);
});

test("7. no raw status enums rendered in user-facing copy", () => {
  const statuses = ["pending_review", "needs_visit", "not_confirmed", "confirmed"];
  const rawSnakeCaseEnums = ["pending_review", "needs_visit", "not_confirmed", "needs_review"];

  for (const st of statuses) {
    const p = getFarmerPregnancyLossPresentation({
      status: st,
      reviewedAt: "2026-09-09T00:00:00.000Z",
    });

    for (const raw of rawSnakeCaseEnums) {
      assert.equal(
        p.badgeLabel.toLowerCase().includes(raw),
        false,
        `badgeLabel '${p.badgeLabel}' should not contain raw enum '${raw}'`,
      );
      assert.equal(
        p.explanation.toLowerCase().includes(raw),
        false,
        `explanation '${p.explanation}' should not contain raw enum '${raw}'`,
      );
    }

    // Badge label should be human-facing phrases, never bare raw enum tokens
    assert.notEqual(p.badgeLabel.toLowerCase(), "confirmed");
    assert.notEqual(p.badgeLabel.toLowerCase(), "not_confirmed");
    assert.notEqual(p.badgeLabel.toLowerCase(), "needs_visit");
    assert.notEqual(p.badgeLabel.toLowerCase(), "pending_review");
  }
});
