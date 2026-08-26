import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getPregnancyCheckReadiness as getServerPregnancyReadiness } from "../src/domain/pregnancy-readiness.js";
import { notifyTechniciansOfBreedingObservation } from "../src/services/breeding-observation-notification.service.js";
import { Notification } from "../src/models/notification.model.js";
import { User } from "../src/models/user.model.js";
import { checkInseminationAgeEligibility } from "../src/utils/cattleCore.js";
import { getReproductionEligibility } from "../src/domain/reproduction-lifecycle.js";
import { isVerifiedFailedAIAttempt } from "../src/services/ai-request-creation.service.js";
import { getStaticAnimalAIEligibility } from "../src/services/ai-eligibility.service.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const DAY = 24 * 60 * 60 * 1000;
const completedAttempt = (daysAgo) => ({
  _id: "attempt-1",
  status: "done",
  inseminationDate: new Date(Date.UTC(2026, 6, 18) - daysAgo * DAY).toISOString(),
});

test("pregnancy readiness blocks Day 59 with an exact available date", () => {
  const at = new Date(Date.UTC(2026, 6, 18, 12));
  const attempt = {
    ...completedAttempt(59),
    inseminationDate: new Date(at.getTime() - 59 * DAY).toISOString(),
  };
  const server = getServerPregnancyReadiness({ insemination: attempt, at });

  assert.equal(server.isEligible, false);
  assert.match(server.reason, /59 days after insemination/i);
  assert.match(server.reason, /available on/i);
  const mobile = source("mobile/lib/reproductionEligibility.ts");
  assert.match(mobile, /PREGNANCY_DIAGNOSIS_MINIMUM_DAYS = 60/);
  assert.match(mobile, /insemination\?\.pregnancyReadiness/);
  assert.doesNotMatch(mobile, /availableDate\.setUTCDate/);
});

test("pregnancy readiness enables the current Day-60 policy", () => {
  const at = new Date(Date.UTC(2026, 6, 18, 12));
  const attempt = {
    ...completedAttempt(60),
    inseminationDate: new Date(at.getTime() - 60 * DAY).toISOString(),
  };
  assert.equal(getServerPregnancyReadiness({ insemination: attempt, at }).isEligible, true);
});

test("work queue, task details, and verification form share readiness guards", () => {
  const queue = source("mobile/features/technician-requests/components/TechnicianMyWorkPanel.tsx");
  const task = source("mobile/app/(technician)/task-details.tsx");
  const animal = source(
    "mobile/features/animals/screens/RoleAwareAnimalDetailsScreen.tsx",
  );
  const form = source("mobile/app/(technician)/pregnancy-verification.tsx");

  for (const code of [queue, form]) {
    assert.match(code, /Pregnancy check not yet available/);
  }
  assert.match(task, /Confirmation not yet available/);
  assert.match(task, /initialPregnancyCheckLocked = Boolean/);
  assert.match(task, /!task\.pregnancyReadiness\.isEligible/);
  assert.match(form, /officialDiagnosisReady/);
  assert.match(form, /pregnancyReadiness\?\.methods/);
  assert.match(animal, /official outcome/);
  assert.match(animal, /observationPresentation/);
});

test("farmer observation stays visible for Likely Pregnant without creating Pregnancy", () => {
  const profile = source(
    "mobile/features/animals/screens/RoleAwareAnimalDetailsScreen.tsx",
  );
  const controller = source("backend/src/controllers/ai-request.controllers.js");
  const start = controller.indexOf("export const submitFarmerBreedingObservation");
  const end = controller.indexOf("export const deleteRequest", start);
  const observationHandler = controller.slice(start, end);

  assert.match(profile, /Observation submitted/);
  assert.match(profile, /Likely Pregnant/);
  assert.match(profile, /farmerObservationSigns/);
  assert.match(profile, /Update observation/);
  assert.doesNotMatch(observationHandler, /Pregnancy\.create/);
  assert.doesNotMatch(observationHandler, /request\.isSuccess\s*=/);
  assert.doesNotMatch(observationHandler, /request\.outcome = "Failed \(Re-heat\)"/);
  assert.match(observationHandler, /notifyTechniciansOfBreedingObservation/);
});

test("legacy farmer outcome route delegates to the canonical observation workflow", () => {
  const controller = source("backend/src/controllers/ai-request.controllers.js");
  const start = controller.indexOf("export const confirmAIOutcome");
  const end = controller.indexOf(
    "export const submitFarmerBreedingObservation",
    start,
  );
  const adapter = controller.slice(start, end);

  assert.match(adapter, /Deprecation/);
  assert.match(adapter, /possible_pregnancy/);
  assert.match(adapter, /return_to_heat/);
  assert.match(adapter, /submitFarmerBreedingObservation\(req, res\)/);
  assert.doesNotMatch(adapter, /outcomeVerificationStatus = "verified"/);
});

test("farmer-requested pregnancy checks remain visible in the technician queue", () => {
  const tasks = source("backend/src/controllers/tasks.controllers.js");
  const notification = source(
    "backend/src/services/breeding-observation-notification.service.js",
  );

  assert.match(tasks, /sourceType: "farmer_requested_verification"/);
  assert.match(tasks, /taskType: "PD"/);
  assert.match(notification, /sendNotificationPush/);
  assert.match(notification, /technician_review_required/);
  assert.match(notification, /Open the linked task to verify the outcome/);
  assert.match(notification, /farmer_observation_reported/);
});

test("one technician receives one contextual notification for the same observation", async () => {
  const originalUserFindOne = User.findOne;
  const originalNotificationUpdate = Notification.findOneAndUpdate;
  const notifications = new Map();
  User.findOne = () => ({ select: async () => ({ _id: "tech-1" }) });
  Notification.findOneAndUpdate = async (query, update) => {
    if (!notifications.has(query.dedupeKey)) {
      notifications.set(query.dedupeKey, update.$setOnInsert);
    }
    return notifications.get(query.dedupeKey);
  };

  const input = {
    farmer: { _id: "farmer-1", name: "Maria Santos" },
    animal: { _id: "animal-1", earTag: "RC26-07" },
    insemination: {
      _id: "attempt-1",
      inseminationDate: new Date("2026-07-07T00:00:00.000Z"),
      approvedBy: "tech-1",
      technicianId: "tech-1",
    },
    task: { _id: "task-1", technicianId: "tech-1" },
    reportType: "possible_pregnancy",
    signs: ["no_return_to_heat"],
    notes: "Eating normally",
    reportedAt: new Date("2026-07-18T08:00:00.000Z"),
    technicianActionRequired: true,
  };

  try {
    await notifyTechniciansOfBreedingObservation(input);
    await notifyTechniciansOfBreedingObservation(input);
    assert.equal(notifications.size, 1);
    const [notification] = notifications.values();
    assert.equal(notification.metadata.animalId, "animal-1");
    assert.equal(notification.metadata.observationId, "attempt-1");
    assert.equal(notification.metadata.taskId, "task-1");
    assert.match(notification.message, /Maria Santos/);
    assert.match(notification.message, /RC26-07/);
    assert.match(notification.message, /possible pregnancy signs/);
    const details = source("mobile/app/notification-details.tsx");
    assert.match(details, /notification\.metadata\?\.taskId/);
    assert.match(details, /\(technician\)\/task-details/);
  } finally {
    User.findOne = originalUserFindOne;
    Notification.findOneAndUpdate = originalNotificationUpdate;
  }
});

test("diagnostic methods use one readable selected-state background in both themes", () => {
  const form = source("mobile/app/(technician)/pregnancy-verification.tsx");
  assert.match(form, /backgroundColor: checkMethod === method\.methodCode/);
  assert.match(form, /isDark \? "#047857" : "#00643B"/);
  assert.match(form, /checkMethod === method\.methodCode \? "#fff"/);
  assert.doesNotMatch(
    form,
    /pillBtnActive[\s\S]{0,180}backgroundColor: isDark \? colors\.card/,
  );
});

test("verified failed Attempt 1 exposes re-insemination and active requests suppress it", () => {
  const failed = {
    _id: "attempt-1",
    status: "done",
    attemptNumber: 1,
    inseminationDate: "2026-06-01T00:00:00.000Z",
    isSuccess: false,
    outcome: "Failed (Re-heat)",
    outcomeVerificationStatus: "verified",
    failureReason: "return_to_heat",
  };
  assert.equal(isVerifiedFailedAIAttempt(failed), true);

  const profile = source("mobile/features/animals/screens/AnimalDetailsScreen.tsx");
  assert.match(profile, /Re-insemination available/);
  assert.match(profile, /mode: "re-inseminate"/);
  assert.match(profile, /requestId: reInsemination\.latestAttempt\._id/);
});

test("AI eligibility fails closed and allows only a healthy adult female", () => {
  const adult = {
    _id: "animal-1",
    gender: "Female",
    species: "Cattle",
    birthDate: "2022-01-01T00:00:00.000Z",
    reproductiveStatus: "Normal",
    inseminations: [],
  };
  assert.equal(checkInseminationAgeEligibility(adult.birthDate, adult.species).isEligible, true);
  assert.equal(checkInseminationAgeEligibility(undefined, adult.species).code, "BIRTH_DATE_REQUIRED");
  assert.equal(checkInseminationAgeEligibility(new Date().toISOString(), adult.species).code, "BELOW_MINIMUM_BREEDING_AGE");
  assert.equal(getReproductionEligibility({ animal: adult }).eligible, true);
  assert.equal(getStaticAnimalAIEligibility({ ...adult, gender: "Male" }).code, "FEMALE_REQUIRED");
  assert.equal(getStaticAnimalAIEligibility({ ...adult, reproductiveStatus: "Pregnant" }).code, "ACTIVE_PREGNANCY");
  assert.equal(getStaticAnimalAIEligibility({ ...adult, reproductiveStatus: "Inseminated" }).code, "ACTIVE_REPRODUCTIVE_WORKFLOW");
  assert.equal(getReproductionEligibility({ animal: adult, activeRequest: { _id: "active-1", status: "pending" } }).code, "ACTIVE_REPRODUCTIVE_WORKFLOW");
  assert.equal(
    getReproductionEligibility({ animal: { ...adult, lastCalvingDate: new Date().toISOString() } }).code,
    "POSTPARTUM_RECOVERY",
  );
  const mobile = source("mobile/lib/reproductionEligibility.ts");
  const backend = source("backend/src/services/ai-eligibility.service.js");
  assert.match(mobile, /FEMALE_REQUIRED/);
  assert.match(mobile, /ACTIVE_AI_REQUEST_EXISTS/);
  assert.match(backend, /getAnimalAIEligibility/);
  assert.match(backend, /checkInseminationAgeEligibility/);
});

test("profile Record AI validates route IDs, locks owner context, and keeps general selection", () => {
  const form = source("mobile/features/technician-ai-recording/components/DirectAIRecordForm.tsx");
  const hook = source("mobile/features/technician-ai-recording/hooks/useRecordAIContext.ts");
  assert.match(hook, /useLocalSearchParams/);
  assert.match(hook, /isCanonicalWorkflowId/);
  assert.match(form, /ANIMAL_FARMER_MISMATCH/);
  assert.match(form, /profileContextLocked/);
  assert.match(form, /setShowFarmerModal\(true\)/);
});

test("normal Record AI is not an implicit historical-record workflow", () => {
  const controller = source("backend/src/controllers/technician.controllers.js");
  assert.match(controller, /ANIMAL_SELECTION_REQUIRED/);
  assert.match(controller, /authorized historical-record workflow/);
  assert.match(controller, /HISTORICAL_AI_WORKFLOW_REQUIRED/);
  assert.match(controller, /getAnimalAIEligibility/);
});
