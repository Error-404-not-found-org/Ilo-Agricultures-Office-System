import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  isExplicitCalvingVisitTask,
  getCalvingTaskPresentation,
  calculateEarliestLiveDeliveryDate,
  getCalvingOutcomeEligibility,
  omitInapplicableCalvingEase,
  validateCalvingOutcomeVitality,
  getFarmerCalvingReadinessPresentation,
  getCalvingTooEarlyErrorMessage,
  toManilaCalendarDay,
  differenceInManilaCalendarDays,
  toManilaDateKey,
} from "./calvingUiSemantics.ts";

test("Calving task semantics: automatic lifecycle task defaults to follow-up semantics", () => {
  const automaticCalvingTask = {
    _id: "task-auto-1",
    taskType: "Calving",
    dueDate: "2026-09-02T00:00:00.000Z",
    sourceType: "task_scheduler",
    category: "Follow-up",
    priority: 2,
    metadata: {
      seedBatch: "RC26-10",
      inseminationId: "ai-1",
    },
  };

  assert.equal(isExplicitCalvingVisitTask(automaticCalvingTask), false);

  const presentation = getCalvingTaskPresentation(automaticCalvingTask);
  assert.equal(presentation.isCalvingTask, true);
  assert.equal(presentation.isExplicitCalvingVisit, false);
  assert.equal(presentation.eyebrow, "CALVING FOLLOW-UP");
  assert.equal(presentation.serviceTitle, "Calving monitoring");
  assert.equal(presentation.scheduleLabel, "Due date");
  assert.equal(presentation.descriptionTitle, "Task Description");
  assert.equal(presentation.showDirections, false);
  assert.equal(presentation.defaultCategory, "Follow-up");
});

test("Calving task semantics: generic task dates or metadata are NOT treated as visit proof", () => {
  // Generic scheduledDate alone
  assert.equal(
    isExplicitCalvingVisitTask({
      taskType: "Calving",
      scheduledDate: "2026-09-02T00:00:00.000Z",
    }),
    false,
  );

  // metadata.scheduledDate alone
  assert.equal(
    isExplicitCalvingVisitTask({
      taskType: "Calving",
      metadata: { scheduledDate: "2026-09-02T00:00:00.000Z" },
    }),
    false,
  );

  // metadata.source === 'create-task' alone
  assert.equal(
    isExplicitCalvingVisitTask({
      taskType: "Calving",
      metadata: { source: "create-task" },
    }),
    false,
  );

  // dueDate alone
  assert.equal(
    isExplicitCalvingVisitTask({
      taskType: "Calving",
      dueDate: "2026-09-02T00:00:00.000Z",
    }),
    false,
  );
});

test("Calving task semantics: explicit visit metadata preserves visit presentation and directions", () => {
  const explicitVisitTask = {
    _id: "task-visit-1",
    taskType: "Calving",
    dueDate: "2026-09-02T00:00:00.000Z",
    visitPeriod: "morning",
    category: "Routine",
    priority: 1,
    metadata: {
      scheduledVisit: true,
    },
  };

  assert.equal(isExplicitCalvingVisitTask(explicitVisitTask), true);

  const presentation = getCalvingTaskPresentation(explicitVisitTask);
  assert.equal(presentation.isCalvingTask, true);
  assert.equal(presentation.isExplicitCalvingVisit, true);
  assert.equal(presentation.eyebrow, "CALVING VISIT");
  assert.equal(presentation.serviceTitle, "Calving assistance");
  assert.equal(presentation.scheduleLabel, "Scheduled visit");
  assert.equal(presentation.descriptionTitle, "Visit / Task Description");
  assert.equal(presentation.showDirections, true);
});

test("Early calving outcome gating: Day 150 disables live-delivery outcomes while keeping Abortion selectable", () => {
  const eligibility = getCalvingOutcomeEligibility({
    gestationDays: 150,
    minimumDays: 253,
  });

  assert.equal(eligibility.hasCanonicalTiming, true);
  assert.equal(eligibility.isDeliveryEligible, false);
  assert.equal(eligibility.isAbortionSelectable, true);
  assert.equal(eligibility.isLiveBirthSelectable, false);
  assert.equal(eligibility.isMixedSelectable, false);
  assert.equal(eligibility.isStillbirthSelectable, false);
});

test("Calving outcome gating: on or after canonical minimum, delivery outcomes are enabled", () => {
  const day253 = getCalvingOutcomeEligibility({
    gestationDays: 253,
    minimumDays: 253,
  });

  assert.equal(day253.isDeliveryEligible, true);
  assert.equal(day253.isLiveBirthSelectable, true);
  assert.equal(day253.isMixedSelectable, true);
  assert.equal(day253.isStillbirthSelectable, true);
  assert.equal(day253.isAbortionSelectable, true);

  const day283 = getCalvingOutcomeEligibility({
    gestationDays: 283,
    minimumDays: 253,
  });
  assert.equal(day283.isDeliveryEligible, true);
});

test("Calving outcome gating: missing canonical readiness does not invent magic fallbacks", () => {
  const missingReadiness = getCalvingOutcomeEligibility({
    gestationDays: 150,
    minimumDays: null,
  });

  assert.equal(missingReadiness.hasCanonicalTiming, false);
  assert.equal(missingReadiness.isDeliveryEligible, false);
  assert.equal(missingReadiness.isLiveBirthSelectable, false);
});

test("Earliest live delivery date: calculated strictly from AI date + minimum delivery days", () => {
  const aiDate = "2026-01-01T07:10:55.956Z";
  const minimumDays = 253;

  const earliestDate = calculateEarliestLiveDeliveryDate(aiDate, minimumDays);
  assert.ok(earliestDate instanceof Date);

  // 2026-01-01 + 253 days = 2026-09-11
  assert.equal(earliestDate.toISOString().slice(0, 10), "2026-09-11");

  // Missing AI date or minimum days returns null without throwing or magic numbers
  assert.equal(calculateEarliestLiveDeliveryDate(null, 253), null);
  assert.equal(calculateEarliestLiveDeliveryDate(aiDate, null), null);
});

test("Calving payload semantics: abortion omits ease while delivery preserves it", () => {
  const abortion = omitInapplicableCalvingEase({
    outcome: "abortion",
    calvingEase: "Natural",
    numberOfCalves: 0,
  });
  assert.equal("calvingEase" in abortion, false);

  const delivery = omitInapplicableCalvingEase({
    outcome: "live_birth",
    calvingEase: "Natural",
    numberOfCalves: 1,
  });
  assert.equal("calvingEase" in delivery ? delivery.calvingEase : undefined, "Natural");
});

test("Calving vitality validation: 1. Mixed + Living + Stillborn -> allowed", () => {
  const result = validateCalvingOutcomeVitality({
    outcome: "mixed",
    calves: [{ isLiving: true }, { isLiving: false }],
  });
  assert.equal(result.isValid, true);
  assert.equal(result.livingCount, 1);
  assert.equal(result.stillbornCount, 1);
  assert.equal(result.error, undefined);
});

test("Calving vitality validation: 2. Mixed + Living + Living -> blocked", () => {
  const result = validateCalvingOutcomeVitality({
    outcome: "mixed",
    calves: [{ isLiving: true }, { isLiving: true }],
  });
  assert.equal(result.isValid, false);
  assert.equal(result.livingCount, 2);
  assert.equal(result.stillbornCount, 0);
  assert.equal(
    result.error,
    "Mixed delivery must include at least one living and one stillborn calf.",
  );
});

test("Calving vitality validation: 3. Mixed + Stillborn + Stillborn -> blocked", () => {
  const result = validateCalvingOutcomeVitality({
    outcome: "mixed",
    calves: [{ isLiving: false }, { isLiving: false }],
  });
  assert.equal(result.isValid, false);
  assert.equal(result.livingCount, 0);
  assert.equal(result.stillbornCount, 2);
  assert.equal(
    result.error,
    "Mixed delivery must include at least one living and one stillborn calf.",
  );
});

test("Calving vitality validation: 4. Live Birth + all living -> allowed", () => {
  const result = validateCalvingOutcomeVitality({
    outcome: "live_birth",
    calves: [{ isLiving: true }, { isLiving: true }],
  });
  assert.equal(result.isValid, true);
  assert.equal(result.livingCount, 2);
  assert.equal(result.stillbornCount, 0);
  assert.equal(result.error, undefined);
});

test("Calving vitality validation: 5. Stillbirth + all stillborn -> allowed", () => {
  const result = validateCalvingOutcomeVitality({
    outcome: "stillbirth",
    calves: [{ isLiving: false }, { isLiving: false }],
  });
  assert.equal(result.isValid, true);
  assert.equal(result.livingCount, 0);
  assert.equal(result.stillbornCount, 2);
  assert.equal(result.error, undefined);
});

test("Calving card layout: 6. Delete calf action remains rendered independently of status controls", () => {
  const farmerCalvingPath = fileURLToPath(
    new URL("../../../app/(farmer)/record-calving.tsx", import.meta.url).href,
  );
  const farmerCalvingSource = readFileSync(farmerCalvingPath, "utf8");

  // 1. Delete button is NOT absolutely positioned over card content
  assert.doesNotMatch(
    farmerCalvingSource,
    /removeCalf\(index\)[\s\S]*?className=["'][^"']*absolute top-4 right-4/,
    "Delete button must not use absolute top-4 right-4 positioning that overlaps status controls",
  );

  // 2. Delete button is rendered in the card header row
  assert.match(
    farmerCalvingSource,
    /Card Header[\s\S]*?Calf #\{index \+ 1\}[\s\S]*?removeCalf\(index\)/,
    "Delete button must be rendered in the card header row beside the calf title",
  );

  // 3. Status/Vitality toggle is in a separate section below header
  assert.match(
    farmerCalvingSource,
    /Status \/ Vitality[\s\S]*?Living[\s\S]*?Stillborn/,
    "Status / Vitality toggle must be in its own section below the card header",
  );

  // 4. Client-side mixed delivery validation is invoked before submit
  assert.match(
    farmerCalvingSource,
    /validateCalvingOutcomeVitality\(\{\s*outcome,\s*calves\s*\}\)/,
    "Farmer form must validate vitality combinations prior to submission",
  );
});

test("Calving real-time inline guidance: farmer and technician screens render banner and dim submit button", () => {
  const farmerPath = fileURLToPath(
    new URL("../../../app/(farmer)/record-calving.tsx", import.meta.url).href,
  );
  const techPath = fileURLToPath(
    new URL("../../../app/(technician)/record-calf-drop.tsx", import.meta.url).href,
  );
  const farmerSource = readFileSync(farmerPath, "utf8");
  const techSource = readFileSync(techPath, "utf8");

  // Farmer form has inline banner and dimmed submit
  assert.match(farmerSource, /isMixedInvalid/);
  assert.match(
    farmerSource,
    /Mixed delivery must include at least one living and one stillborn calf\./,
  );
  assert.match(farmerSource, /opacity:\s*isMixedInvalid\s*\?\s*0\.6\s*:\s*1/);

  // Technician form has inline banner and dimmed submit
  assert.match(techSource, /isMixedInvalid/);
  assert.match(
    techSource,
    /Mixed delivery must include at least one living and one stillborn calf\./,
  );
  assert.match(techSource, /\$\{isMixedInvalid \? 'opacity-60' : ''\}/);
});

test("Early Calving 1: readiness false / Day 150 -> Record Calving cannot be opened", () => {
  const presentation = getFarmerCalvingReadinessPresentation({
    isEligible: false,
    code: "CALVING_TOO_EARLY",
    gestationDays: 150,
    minimumDays: 253,
    daysRemaining: 103,
    earliestEligibleDate: "2026-12-20T00:00:00.000Z",
  });
  assert.equal(presentation.canRecordCalving, false);
  assert.equal(presentation.badgeLabel, "Not ready for delivery recording");
  assert.equal(presentation.gestationProgressLabel, "Day 150");
  assert.equal(presentation.deliveryAvailabilityLabel, "Delivery recording available from");
  assert.equal(presentation.minimumThresholdLabel, "Day 253 · Dec 20, 2026");
  assert.equal(presentation.countdownLabel, "103 days until recording is available");
  assert.ok(presentation.earliestEligibleDateFormatted?.includes("Dec 20, 2026"));

  // Check PregnancyTrackerScreen source to verify Record Calving is disabled when not eligible
  const trackerPath = fileURLToPath(
    new URL("../screens/PregnancyTrackerScreen.tsx", import.meta.url).href,
  );
  const trackerSource = readFileSync(trackerPath, "utf8");
  assert.match(trackerSource, /!isTechnician && !farmerReadiness\.isReadinessUnavailable && !farmerReadiness\.canRecordCalving/);
  assert.match(trackerSource, /Record Calving\s*<\/Text>\s*<\/View>/);
});

test("Early Calving 2: readiness false -> Report Pregnancy Loss remains available", () => {
  const trackerPath = fileURLToPath(
    new URL("../screens/PregnancyTrackerScreen.tsx", import.meta.url).href,
  );
  const trackerSource = readFileSync(trackerPath, "utf8");

  // Pregnancy Concern section with Report Pregnancy Loss is rendered
  assert.match(trackerSource, /Pregnancy Concern/);
  assert.match(
    trackerSource,
    /Report signs or observations that may indicate pregnancy\s+loss\./,
  );
  assert.match(
    trackerSource,
    /pathname:\s*["']\/\(farmer\)\/report-pregnancy-loss["']/,
  );
});

test("Early Calving 3: readiness true -> Record Calving remains available", () => {
  const presentation = getFarmerCalvingReadinessPresentation({
    isEligible: true,
    code: "CALVING_WINDOW_OPEN",
    gestationDays: 260,
    minimumDays: 253,
  });
  assert.equal(presentation.canRecordCalving, true);
  assert.equal(presentation.isEligible, true);

  const trackerPath = fileURLToPath(
    new URL("../screens/PregnancyTrackerScreen.tsx", import.meta.url).href,
  );
  const trackerSource = readFileSync(trackerPath, "utf8");
  assert.match(
    trackerSource,
    /pathname:\s*["']\/\(farmer\)\/record-calving["']/,
  );
});

test("Early Calving 4: CALVING_TOO_EARLY -> does NOT navigate to Pregnancy Loss Report", () => {
  const farmerCalvingPath = fileURLToPath(
    new URL("../../../app/(farmer)/record-calving.tsx", import.meta.url).href,
  );
  const farmerCalvingSource = readFileSync(farmerCalvingPath, "utf8");

  // Status 422 alone does NOT trigger redirect to pregnancy loss report
  assert.doesNotMatch(
    farmerCalvingSource,
    /error\.response\?\.status === 422[\s\S]*?report-pregnancy-loss/,
  );

  // CALVING_TOO_EARLY does NOT navigate away; it calls return instead of router.replace
  assert.match(
    farmerCalvingSource,
    /if\s*\(\s*errorCode === ["']CALVING_TOO_EARLY["']\s*\)\s*\{[\s\S]*?toast\.error[\s\S]*?return;\s*\}/,
  );
});

test("Early Calving 5: CALVING_TOO_EARLY -> shows readiness error", () => {
  const errorMsg = getCalvingTooEarlyErrorMessage({
    minimumDays: 253,
    earliestEligibleDate: "2026-12-20T00:00:00.000Z",
  });
  assert.match(
    errorMsg,
    /Calving cannot be recorded yet\. Live delivery recording becomes available on Day 253\./,
  );
  assert.match(errorMsg, /Earliest recording date: Dec 20, 2026\./);

  const farmerCalvingPath = fileURLToPath(
    new URL("../../../app/(farmer)/record-calving.tsx", import.meta.url).href,
  );
  const farmerCalvingSource = readFileSync(farmerCalvingPath, "utf8");
  assert.match(
    farmerCalvingSource,
    /getCalvingTooEarlyErrorMessage\(\s*details,\s*error\.response\?\.data\?\.message,?\s*\)/,
  );
  assert.match(farmerCalvingSource, /setSubmissionError\(errorMessage\)/);
});

test("Early Calving 6: PREGNANCY_LOSS_REQUIRES_REVIEW -> still offers/routes to Pregnancy Loss Report", () => {
  const farmerCalvingPath = fileURLToPath(
    new URL("../../../app/(farmer)/record-calving.tsx", import.meta.url).href,
  );
  const farmerCalvingSource = readFileSync(farmerCalvingPath, "utf8");

  assert.match(
    farmerCalvingSource,
    /if\s*\(\s*errorCode === ["']PREGNANCY_LOSS_REQUIRES_REVIEW["']\s*\)\s*\{[\s\S]*?router\.replace\(\{[\s\S]*?pathname:\s*["']\/\(farmer\)\/report-pregnancy-loss["']/,
  );
});

test("Early Calving 7: deep-linked Record Calving while not eligible -> blocked state, normal delivery form unavailable, no automatic redirect", () => {
  const farmerCalvingPath = fileURLToPath(
    new URL("../../../app/(farmer)/record-calving.tsx", import.meta.url).href,
  );
  const farmerCalvingSource = readFileSync(farmerCalvingPath, "utf8");

  // Defensively checks readiness from active pregnancy
  assert.match(
    farmerCalvingSource,
    /isCalvingBlocked\s*=\s*Boolean\(isReadinessUnavailable\s*\|\|\s*readiness\?\.isEligible === false\)/,
  );

  // Renders blocked state
  assert.match(
    farmerCalvingSource,
    /isCalvingBlocked\s*\?[\s\S]*?Calving Not Yet Available/,
  );

  // Primary action is Back to Reproductive Status
  assert.match(
    farmerCalvingSource,
    /Back to Reproductive Status/,
  );

  // Explicit secondary action to report pregnancy loss
  assert.match(
    farmerCalvingSource,
    /Report Pregnancy Loss/,
  );

  // Does NOT automatically redirect in useEffect or on mount
  assert.doesNotMatch(
    farmerCalvingSource,
    /useEffect\(\(\)\s*=>\s*\{[\s\S]*?isCalvingBlocked[\s\S]*?router\.(replace|push)/,
  );
});

test("Early Calving 8: Scenario 08 calendar-day consistency and boundary tests", () => {
  const inseminationDate = "2026-04-11";
  const expectedCalvingDate = "2027-01-19";
  const minimumDays = 253;
  const avgGestationDays = 283;

  // A. Apr 11 (Day 0)
  const g0 = differenceInManilaCalendarDays("2026-04-11", inseminationDate);
  assert.equal(g0, 0);

  // B. Apr 12 (Day 1)
  const g1 = differenceInManilaCalendarDays("2026-04-12", inseminationDate);
  assert.equal(g1, 1);

  // C. Sep 8 (Day 150)
  const gSep8 = differenceInManilaCalendarDays("2026-09-08", inseminationDate);
  assert.equal(gSep8, 150);
  const minRemSep8 = Math.max(0, minimumDays - gSep8!);
  assert.equal(minRemSep8, 103);
  const expRemSep8 = differenceInManilaCalendarDays(expectedCalvingDate, "2026-09-08");
  assert.equal(expRemSep8, 133);
  assert.equal(gSep8! + minRemSep8, minimumDays);
  assert.equal(gSep8! + expRemSep8!, avgGestationDays);

  // D. Sep 9 (Day 151)
  const gSep9 = differenceInManilaCalendarDays("2026-09-09", inseminationDate);
  assert.equal(gSep9, 151);
  const minRemSep9 = Math.max(0, minimumDays - gSep9!);
  assert.equal(minRemSep9, 102);
  const expRemSep9 = differenceInManilaCalendarDays(expectedCalvingDate, "2026-09-09");
  assert.equal(expRemSep9, 132);
  assert.equal(gSep9! + minRemSep9, minimumDays);
  assert.equal(gSep9! + expRemSep9!, avgGestationDays);

  // E. Dec 19 (Day 252)
  const gDec19 = differenceInManilaCalendarDays("2026-12-19", inseminationDate);
  assert.equal(gDec19, 252);
  assert.equal(Math.max(0, minimumDays - gDec19!), 1);

  // F. Dec 20 (Day 253)
  const gDec20 = differenceInManilaCalendarDays("2026-12-20", inseminationDate);
  assert.equal(gDec20, 253);
  assert.equal(Math.max(0, minimumDays - gDec20!), 0);

  // G. Jan 19, 2027 (Day 283)
  const gJan19 = differenceInManilaCalendarDays("2027-01-19", inseminationDate);
  assert.equal(gJan19, 283);
  assert.equal(differenceInManilaCalendarDays(expectedCalvingDate, "2027-01-19"), 0);

  // Earliest live delivery date remains Dec 20, 2026
  const earliestDate = calculateEarliestLiveDeliveryDate(inseminationDate, minimumDays);
  assert.equal(toManilaDateKey(earliestDate), "2026-12-20");
});

test("Early Calving 9: Time-of-day insensitivity in Asia/Manila", () => {
  const aiTimeVariations = [
    "2026-04-10T16:01:00.000Z", // 00:01 Manila Apr 11
    "2026-04-10T23:30:00.000Z", // 07:30 Manila Apr 11
    "2026-04-11T06:00:00.000Z", // 14:00 Manila Apr 11
    "2026-04-11T15:59:00.000Z", // 23:59 Manila Apr 11
  ];

  const checkTimesSep9 = [
    "2026-09-08T16:01:00.000Z", // 00:01 Manila Sep 9
    "2026-09-09T00:00:00.000Z", // 08:00 Manila Sep 9
    "2026-09-09T06:00:00.000Z", // 14:00 Manila Sep 9
    "2026-09-09T15:59:00.000Z", // 23:59 Manila Sep 9
  ];

  for (const ai of aiTimeVariations) {
    for (const check of checkTimesSep9) {
      const g = differenceInManilaCalendarDays(check, ai);
      assert.equal(g, 151, `AI ${ai} vs Check ${check} must resolve to Day 151`);
    }
  }

  // Crossing midnight boundary
  const justBeforeMidnight = "2026-09-08T15:59:59.999Z"; // 23:59:59 Sep 8 Manila
  const atMidnight = "2026-09-08T16:00:00.000Z"; // 00:00:00 Sep 9 Manila
  assert.equal(differenceInManilaCalendarDays(justBeforeMidnight, "2026-04-11"), 150);
  assert.equal(differenceInManilaCalendarDays(atMidnight, "2026-04-11"), 151);
});

test("Calving Readiness: 1. Distinguishes Expected calving from Delivery recording available from", () => {
  const presentation = getFarmerCalvingReadinessPresentation({
    isEligible: false,
    gestationDays: 151,
    minimumDays: 253,
    averageGestationDays: 283,
    daysRemaining: 102,
    earliestEligibleDate: "2026-12-20T00:00:00.000Z",
    expectedCalvingDate: "2027-01-19T00:00:00.000Z",
    expectedCalvingDaysRemaining: 132,
  });

  assert.equal(presentation.expectedCalvingLabel, "Expected calving");
  assert.equal(presentation.expectedCalvingDateFormatted, "Jan 19, 2027");
  assert.equal(presentation.currentGestationLabel, "Current gestation");
  assert.equal(presentation.gestationProgressLabel, "Day 151 of 283");
  assert.equal(presentation.deliveryAvailabilityLabel, "Delivery recording available from");
  assert.equal(presentation.minimumThresholdLabel, "Day 253 · Dec 20, 2026");
  assert.equal(presentation.countdownLabel, "102 days until recording is available");
  assert.equal(presentation.badgeLabel, "Not ready for delivery recording");
  assert.equal(
    presentation.supportingCopy,
    "This animal has not yet reached the minimum gestation day for recording Live Birth, Mixed, or Stillbirth.",
  );
  assert.equal(presentation.canRecordCalving, false);
});

test("Calving Readiness: 2. UI does NOT describe Day 253 as expected calving", () => {
  const presentation = getFarmerCalvingReadinessPresentation({
    isEligible: false,
    gestationDays: 151,
    minimumDays: 253,
    averageGestationDays: 283,
    daysRemaining: 102,
    earliestEligibleDate: "2026-12-20T00:00:00.000Z",
    expectedCalvingDate: "2027-01-19T00:00:00.000Z",
  });

  // Expected calving is Jan 19, 2027 (Day 283), NOT Dec 20 / Day 253
  assert.notEqual(presentation.expectedCalvingDateFormatted, "Dec 20, 2026");
  assert.equal(presentation.expectedCalvingDateFormatted, "Jan 19, 2027");
  assert.equal(presentation.minimumThresholdLabel, "Day 253 · Dec 20, 2026");
});

test("Calving Readiness: 3. Dynamic minimumDays = 260 proves UI does not hard-code 253", () => {
  const presentation = getFarmerCalvingReadinessPresentation({
    isEligible: false,
    gestationDays: 150,
    minimumDays: 260,
    averageGestationDays: 285,
    daysRemaining: 110,
    earliestEligibleDate: "2026-12-27T00:00:00.000Z",
  });

  assert.equal(presentation.minimumDays, 260);
  assert.equal(presentation.minimumThresholdLabel, "Day 260 · Dec 27, 2026");
  assert.equal(presentation.countdownLabel, "110 days until recording is available");
  assert.doesNotMatch(presentation.minimumThresholdLabel, /253/);
});

test("Calving Readiness: 4. Dynamic minimumDays = 120 proves species-safe presentation (e.g. Swine)", () => {
  const presentation = getFarmerCalvingReadinessPresentation({
    isEligible: false,
    gestationDays: 80,
    minimumDays: 120,
    averageGestationDays: 150,
    daysRemaining: 40,
    earliestEligibleDate: "2026-07-01T00:00:00.000Z",
  });

  assert.equal(presentation.minimumDays, 120);
  assert.equal(presentation.minimumThresholdLabel, "Day 120 · Jul 1, 2026");
  assert.equal(presentation.gestationProgressLabel, "Day 80 of 150");
  assert.equal(presentation.countdownLabel, "40 days until recording is available");
  assert.doesNotMatch(presentation.minimumThresholdLabel, /253/);
});

test("Calving Readiness: 5. Backend readiness unavailable -> neutral safe state, no 253 fallback, normal delivery not enabled", () => {
  // A. null readiness
  const nullPresentation = getFarmerCalvingReadinessPresentation(null);
  assert.equal(nullPresentation.isReadinessUnavailable, true);
  assert.equal(nullPresentation.canRecordCalving, false);
  assert.equal(nullPresentation.isEligible, false);
  assert.equal(nullPresentation.minimumDays, null);
  assert.equal(nullPresentation.badgeLabel, "Readiness unavailable");
  assert.equal(
    nullPresentation.message,
    "We couldn't verify whether delivery recording is available right now.",
  );

  // B. missing minimumDays
  const missingMinPresentation = getFarmerCalvingReadinessPresentation({
    gestationDays: 150,
    minimumDays: null,
  });
  assert.equal(missingMinPresentation.isReadinessUnavailable, true);
  assert.equal(missingMinPresentation.canRecordCalving, false);
  assert.equal(missingMinPresentation.minimumDays, null);
});

test("Calving Readiness: 6. CALVING_TOO_EARLY error message uses backend minimumDays dynamically without 253 fallback", () => {
  // With dynamic minimumDays = 260
  const msg260 = getCalvingTooEarlyErrorMessage({
    minimumDays: 260,
    earliestEligibleDate: "2026-12-27T00:00:00.000Z",
  });
  assert.match(msg260, /Day 260\./);
  assert.match(msg260, /Dec 27, 2026\./);
  assert.doesNotMatch(msg260, /253/);

  // With dynamic minimumDays = 120
  const msg120 = getCalvingTooEarlyErrorMessage({
    minimumDays: 120,
    earliestEligibleDate: "2026-07-01T00:00:00.000Z",
  });
  assert.match(msg120, /Day 120\./);
  assert.match(msg120, /Jul 1, 2026\./);
  assert.doesNotMatch(msg120, /253/);

  // When details has no minimumDays -> does NOT invent 253
  const msgNoMin = getCalvingTooEarlyErrorMessage({});
  assert.doesNotMatch(msgNoMin, /253/);
  assert.match(
    msgNoMin,
    /The minimum gestation day for live delivery recording has not been reached\./,
  );
});

test("Calving Readiness: 7. Farmer Pregnancy Loss action remains separate and only renders when confirmed pregnant", () => {
  const trackerPath = fileURLToPath(
    new URL("../screens/PregnancyTrackerScreen.tsx", import.meta.url).href,
  );
  const trackerSource = readFileSync(trackerPath, "utf8");

  // Renders distinct PREGNANCY CONCERN section
  assert.match(trackerSource, /Pregnancy Concern/);
  assert.match(trackerSource, /Notice something unusual\?/);
  assert.match(
    trackerSource,
    /Report signs or observations that may indicate pregnancy loss\./,
  );
  assert.match(
    trackerSource,
    /!isTechnician && !activeLossReport && isConfirmedPregnant/,
  );

  const farmerCalvingPath = fileURLToPath(
    new URL("../../../app/(farmer)/record-calving.tsx", import.meta.url).href,
  );
  const farmerCalvingSource = readFileSync(farmerCalvingPath, "utf8");
  assert.match(
    farmerCalvingSource,
    /hasActiveConfirmedPregnancy\s*\?[\s\S]*?Report Pregnancy Loss/,
  );
});

test("Calving Readiness: 8. Technician Mobile preserves strict backend readiness requirement and uses delivery recording wording", () => {
  const techPath = fileURLToPath(
    new URL("../../../app/(technician)/record-calf-drop.tsx", import.meta.url).href,
  );
  const techSource = readFileSync(techPath, "utf8");

  // Rejects when minimumDays is not a number
  assert.match(
    techSource,
    /typeof readiness\?\.minimumDays !== 'number' \|\| gestationDays === null/,
  );

  // Uses Expected calving and Delivery recording available from
  assert.match(techSource, /Expected calving:/);
  assert.match(techSource, /Delivery recording available from Day/);
  assert.match(techSource, /Delivery recording is available/);

  // Does NOT contain misleading phrases
  assert.doesNotMatch(techSource, /Earliest normal delivery/i);
  assert.doesNotMatch(techSource, /Expected delivery start/i);
  assert.doesNotMatch(techSource, /Live-birth recording is too early/i);
});

test("Calving Readiness: 9. Safeguard 1: averageGestationDays is not mandatory for readiness", () => {
  // If averageGestationDays is missing but minimumDays and isEligible are present
  const presentation = getFarmerCalvingReadinessPresentation({
    isEligible: false,
    gestationDays: 151,
    minimumDays: 253,
    averageGestationDays: null,
    daysRemaining: 102,
    earliestEligibleDate: "2026-12-20T00:00:00.000Z",
  });

  assert.equal(presentation.isReadinessUnavailable, false);
  assert.equal(presentation.canRecordCalving, false);
  assert.equal(presentation.gestationProgressLabel, "Day 151");
  assert.doesNotMatch(presentation.gestationProgressLabel!, /of/);
  assert.equal(presentation.minimumThresholdLabel, "Day 253 · Dec 20, 2026");

  // Eligible case without averageGestationDays
  const eligiblePresentation = getFarmerCalvingReadinessPresentation({
    isEligible: true,
    gestationDays: 260,
    minimumDays: 253,
    averageGestationDays: null,
  });
  assert.equal(eligiblePresentation.isReadinessUnavailable, false);
  assert.equal(eligiblePresentation.canRecordCalving, true);
  assert.equal(eligiblePresentation.gestationProgressLabel, "Day 260");
});

test("Calving Readiness: 10. Safeguard 3: Try Again refetches canonical readiness source and invalidates tracker query", () => {
  const trackerPath = fileURLToPath(
    new URL("../screens/PregnancyTrackerScreen.tsx", import.meta.url).href,
  );
  const trackerSource = readFileSync(trackerPath, "utf8");
  assert.match(
    trackerSource,
    /query\.refetch\(\);[\s\S]*?queryClient\.invalidateQueries\(\{\s*queryKey:\s*breedingKeys\.tracker\(id\)\s*\}\);/,
  );

  const farmerCalvingPath = fileURLToPath(
    new URL("../../../app/(farmer)/record-calving.tsx", import.meta.url).href,
  );
  const farmerCalvingSource = readFileSync(farmerCalvingPath, "utf8");
  assert.match(
    farmerCalvingSource,
    /refetchAnimalData\(\);[\s\S]*?queryClient\.invalidateQueries\(\{\s*queryKey:\s*breedingKeys\.tracker\(animalId\)\s*\}\);/,
  );
});
