import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  normalizePushNotificationData,
  presentNotificationCopy,
  presentNotificationDocument,
  sanitizeNotificationText,
} from "../src/domain/notification-presentation.js";
import { getDispatchRequestNotificationPresentation } from "../src/services/dispatch-request-notification.service.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("notification fallback copy removes technical and seed-facing language", () => {
  const result = sanitizeNotificationText(
    "🧪 [Summary] SEED-repro-manual-20260717-Animal is EMPTY at Day 75 post-AI; PD is N/A.",
  );

  assert.equal(
    result,
    "Animal is Not pregnant at 75 days after the AI service; pregnancy diagnosis is Not recorded.",
  );
  assert.doesNotMatch(result, /SEED|EMPTY|post-AI|\bPD\b|N\/A|🧪/);
});

test("structured service copy tells each role what happened and what to do next", () => {
  const urgent = presentNotificationCopy({
    eventType: "service_request_submitted",
    metadata: {
      serviceType: "health",
      animalTag: "CB-014",
      urgency: "emergency",
      location: "Oton, Poblacion",
    },
  });
  const completed = presentNotificationCopy({
    eventType: "service_completed",
    metadata: { serviceType: "ai", animalTag: "CB-014" },
  });
  const fieldRecord = presentNotificationCopy({
    eventType: "field_ai_recorded",
    metadata: {
      animalTag: "CB-014",
      technicianName: "Juan Dela Cruz",
    },
  });

  assert.equal(urgent.title, "Urgent health assistance request for CB-014");
  assert.match(urgent.message, /Open it to review the details and claim the visit\./);
  assert.equal(completed.title, "AI service completed");
  assert.match(completed.message, /technician must confirm any reproductive outcome/);
  assert.equal(fieldRecord.title, "AI service recorded for CB-014");
  assert.match(fieldRecord.message, /Juan Dela Cruz recorded the completed AI service/);
});

test("dispatch copy identifies re-insemination without claiming service completion", () => {
  const copy = getDispatchRequestNotificationPresentation({
    request: {
      _id: "attempt-2",
      previousAttemptId: "attempt-1",
      attemptNumber: 2,
    },
    requestType: "AI",
    animal: { earTag: "CB-014" },
    farmer: { name: "Maria Santos" },
    displayLocation: "Buray, Oton",
  });

  assert.equal(copy.eventType, "re_insemination_requested");
  assert.equal(copy.requestKind, "re_insemination");
  assert.match(copy.title, /Re-insemination request/i);
  assert.match(copy.message, /Maria Santos requested another AI service/i);
  assert.match(copy.message, /previous attempt was confirmed unsuccessful/i);
  assert.doesNotMatch(`${copy.title} ${copy.message}`, /service completed/i);
});

test("re-insemination context survives the scheduled service lifecycle", () => {
  const scheduledDate = "2026-08-18T05:00:00.000Z";
  const cases = [
    ["service_visit_scheduled", "Re-insemination scheduled", /Aug 18, 2026/],
    ["service_visit_rescheduled", "Re-insemination rescheduled", /Aug 18, 2026/],
    ["service_started", "Re-insemination started", /started the re-insemination service/],
    ["service_completed", "Re-insemination completed", /re-insemination service.*complete/],
  ];

  for (const [eventType, expectedTitle, expectedMessage] of cases) {
    const copy = presentNotificationCopy({
      eventType,
      metadata: {
        serviceType: "ai",
        requestKind: "re_insemination",
        animalTag: "CB-014",
        technicianName: "Juan Dela Cruz",
        scheduledDate,
        visitPeriod: "afternoon",
      },
    });

    assert.equal(copy.title, expectedTitle);
    assert.match(copy.message, expectedMessage);
  }
});

test("pregnancy, safety, and cancellation copy uses approved user-facing terms", () => {
  const pregnancy = presentNotificationCopy({
    eventType: "pregnancy_not_confirmed",
    metadata: { animalTag: "CB-014" },
  });
  const returnToHeat = presentNotificationCopy({
    eventType: "return_to_heat_confirmed",
    metadata: { animalTag: "CB-014" },
  });
  const withdrawal = presentNotificationCopy({
    eventType: "withdrawal_safety_active",
    metadata: {
      animalTag: "CB-014",
      withdrawalEndDate: "2026-08-05T00:00:00.000Z",
      medicineName: "Oxytetracycline",
    },
  });
  const cancellation = presentNotificationCopy({
    eventType: "cancellation_requested",
    metadata: {
      serviceType: "health",
      animalTag: "CB-014",
      farmerName: "Maria Santos",
      reason: "Animal recovered",
    },
  });

  assert.equal(pregnancy.title, "Pregnancy not confirmed for CB-014");
  assert.doesNotMatch(pregnancy.message, /Empty|negative PD/i);
  assert.equal(returnToHeat.title, "Return to heat confirmed");
  assert.match(returnToHeat.message, /CB-014 returned to heat after insemination/i);
  assert.doesNotMatch(returnToHeat.title, /pregnancy not confirmed/i);
  assert.equal(withdrawal.title, "Food safety withdrawal period active");
  assert.match(withdrawal.message, /Do not consume or sell meat or milk/);
  assert.match(cancellation.message, /needs review|asked to cancel|Reason:/i);
});

test("notification documents and push payloads share canonical presentation metadata", () => {
  const presented = presentNotificationDocument({
    _id: "notification-1",
    title: "Pregnancy Check: EMPTY ❌",
    message: "Result: EMPTY",
    eventType: "pregnancy_not_confirmed",
    metadata: { animalTag: "CB-014" },
  });
  const pushData = normalizePushNotificationData({
    type: "HEALTH",
    notificationId: 123,
    requestId: 456,
    relatedId: 789,
  });

  assert.equal(presented.title, "Pregnancy not confirmed for CB-014");
  assert.equal(pushData.type, "health-request");
  assert.equal(pushData.notificationId, "123");
  assert.equal(pushData.requestId, "456");
  assert.equal(pushData.relatedId, "789");
});

test("notification delivery contracts use valid schema fields and mobile handles push taps", () => {
  const ai = source("backend/src/controllers/ai-request.controllers.js");
  const health = source("backend/src/controllers/health-request.controllers.js");
  const delivery = source("backend/src/services/notification-delivery.service.js");
  const layout = source("mobile/app/_layout.tsx");

  assert.doesNotMatch(`${ai}\n${health}`, /type:\s*["']cancellation_request["']/);
  assert.doesNotMatch(`${ai}\n${health}`, /Notification\.create\(\{[\s\S]{0,200}?userId:/);
  assert.match(delivery, /includeResultMetadata:\s*true/);
  assert.match(delivery, /!result\.lastErrorObject\.updatedExisting/);
  assert.match(layout, /addNotificationResponseReceivedListener/);
  assert.match(layout, /getLastNotificationResponse(?:Async)?/);
  assert.match(layout, /getPushNotificationTarget/);
});

test("scheduled reminder copy avoids unexplained clinical shorthand", () => {
  const reminders = source("backend/src/config/inngest.js");

  assert.doesNotMatch(reminders, /Mr\.|'s cow|Dystocia risk|\bPD is now due\b/);
  assert.match(reminders, /Pregnancy diagnosis is due/);
  assert.match(reminders, /does not have a completed service record/);
});

test("transactional record pushes are dispatched only from post-commit paths", () => {
  const technician = source("backend/src/controllers/technician.controllers.js");
  const livestockTransaction = source("backend/src/services/livestock-transaction.service.js");
  const reminders = source("backend/src/config/inngest.js");

  assert.match(livestockTransaction, /eventType:\s*"field_ai_recorded"/);
  assert.match(technician, /await recordTechnicianAIService\([\s\S]*?await sendNotificationPush\(/);
  assert.match(reminders, /step\.run\("send-calving-recorded-push"/);
  assert.match(reminders, /recordId:\s*calvingId/);
});
