/* global __dirname */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (...segments) =>
  fs.readFileSync(path.join(__dirname, "..", ...segments), "utf-8");
const readRepository = (...segments) =>
  fs.readFileSync(path.join(__dirname, "..", "..", ...segments), "utf-8");

const loadTypeScriptModule = (...segments) => {
  const ts = require("typescript");
  const source = read(...segments);
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    require,
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
};

test("H4 Request Details architecture and lifecycle", async (t) => {
  const routeCode = read("app", "(technician)", "request-details.tsx");
  const aiCode = read(
    "features",
    "technician-requests",
    "components",
    "AIRequestDetails.tsx",
  );
  const healthCode = read(
    "features",
    "technician-health-request",
    "components",
    "HealthRequestDetails.tsx",
  );
  const healthModalCode = read(
    "features",
    "technician-health-request",
    "components",
    "HealthVisitScheduleModal.tsx",
  );
  const requestsScreenCode = read(
    "features",
    "technician-requests",
    "screens",
    "TechnicianRequestsScreen.tsx",
  );
  const requestCardCode = read(
    "features",
    "technician-requests",
    "components",
    "RequestListCard.tsx",
  );
  const dashboardHookCode = read(
    "features",
    "technician-dashboard",
    "hooks",
    "useTechnicianDashboardScreen.ts",
  );
  const dashboardRequestsCode = read(
    "features",
    "technician-dashboard",
    "components",
    "TechnicianRequestsSection.tsx",
  );
  const myWorkCode = read(
    "features",
    "technician-requests",
    "components",
    "TechnicianMyWorkPanel.tsx",
  );
  const aiScheduleCode = aiCode.slice(aiCode.indexOf("function AIScheduleModal"));
  const oldAIPath = path.join(
    __dirname,
    "../features/technician-requests/components/AIRequestModal.tsx",
  );
  const duplicateHealthRoute = path.join(
    __dirname,
    "../app/(technician)/health-request-details.tsx",
  );

  await t.test("the canonical route only loads and delegates AI or Health", () => {
    assert.match(routeCode, /<AIRequestDetails/);
    assert.match(routeCode, /<HealthRequestDetails/);
    assert.match(routeCode, /requestType === "health"/);
    assert.match(routeCode, /getTechnicianRequestDetail/);
    assert.doesNotMatch(routeCode, /claimAndScheduleAIRequest|claimTechnicianRequest/);
    assert.doesNotMatch(routeCode, /DateTimePicker|scheduledDate.*visitPeriod/s);
    assert.equal(fs.existsSync(oldAIPath), false);
    assert.equal(fs.existsSync(duplicateHealthRoute), false);
  });

  await t.test("AI is a normal page with a compact internal schedule modal", () => {
    assert.match(aiCode, /export function AIRequestDetails/);
    assert.match(aiCode, /<AppPageHeader title="Request Details"/);
    assert.doesNotMatch(aiCode, /presentationStyle="fullScreen"/);
    assert.match(aiScheduleCode, /Set AI Visit/);
    assert.match(aiScheduleCode, /Today/);
    assert.match(aiScheduleCode, /Tomorrow/);
    assert.match(aiScheduleCode, /Choose date/);
    assert.match(aiScheduleCode, /Morning|morning/);
    assert.match(aiScheduleCode, /Afternoon|afternoon/);
    assert.match(aiScheduleCode, /Accept & Schedule/);
    assert.doesNotMatch(
      aiScheduleCode,
      /Farmer & Location|Animal\n|Heat signs|Attachments/,
    );
    assert.doesNotMatch(aiScheduleCode, /preferredDate|preferredTime|12:00 PM/);
  });

  await t.test("AI review shows contact and full location before acceptance", () => {
    assert.match(aiCode, /farmer\?\.phoneNumber/);
    assert.match(aiCode, /farmLocation\.detectedAddress/);
    assert.match(aiCode, /farmLocation\.landmark/);
    assert.match(aiCode, /farmLocation\.latitude/);
    assert.match(aiCode, /Get Directions/);
    assert.match(aiCode, /Accept & Set Visit/);
    assert.doesNotMatch(aiCode, /available after accepting|Claim request to view contact/i);
    assert.doesNotMatch(aiCode, /municipality \|\| "Iloilo"/);
  });

  await t.test("AI Accept & Schedule remains atomic and online-only", () => {
    assert.match(aiCode, /NetInfo\.fetch\(\)/);
    assert.match(aiCode, /claimAndScheduleAIRequest\(api, workflowId, payload\)/);
    assert.match(aiCode, /scheduledDate: formatLocalCalendarDate\(selectedDate\)/);
    assert.match(aiCode, /visitPeriod: visitPeriod as VisitPeriod/);
    assert.match(aiCode, /params: \{ section: "myWork" \}/);
    assert.doesNotMatch(aiCode, /claimTechnicianRequest\(api, "ai"/);
  });

  await t.test("AI conflict refreshes all workflow caches without optimistic ownership", () => {
    assert.match(aiCode, /error\?\.response\?\.status === 409/);
    assert.match(aiCode, /getClaimScheduleErrorMessage\(error\)/);
    assert.match(aiCode, /technicianKeys\.requests\(\)/);
    assert.match(aiCode, /technicianKeys\.workQueue\(\)/);
    assert.match(aiCode, /technicianKeys\.dashboard\(\)/);
    assert.match(aiCode, /technicianKeys\.tasks\(\)/);
    assert.doesNotMatch(aiCode, /setRequest\([^)]*approvedBy/);
  });

  await t.test("AI lifecycle actions are truthful", () => {
    assert.match(aiCode, /\? "Accept & Set Visit"/);
    assert.match(aiCode, /\? "Set Visit"/);
    assert.match(aiCode, /\? "Record AI Service"/);
    assert.match(aiCode, /\? "Continue AI Service"/);
    assert.match(aiCode, /\? "View AI Record"/);
    assert.match(aiCode, /accessibilityLabel="Reschedule"/);
    assert.match(aiCode, /accessibilityLabel="Cancel With Reason"/);
  });

  await t.test("AI record navigation sends identifiers instead of request objects", () => {
    assert.match(aiCode, /pathname: "\/\(technician\)\/record-ai"/);
    assert.match(aiCode, /mode: "request-linked"/);
    assert.match(aiCode, /requestId,/);
    assert.match(aiCode, /workflowId/);
    assert.match(aiCode, /taskId/);
    assert.match(aiCode, /farmerId/);
    assert.match(aiCode, /animalId/);
    assert.doesNotMatch(aiCode, /params:\s*\{[^}]*request,/s);
  });

  await t.test("Health review shows contact and location before acceptance", () => {
    assert.match(healthCode, /<AppPageHeader title="Request Details"/);
    assert.match(healthCode, /farmer\?\.phoneNumber/);
    assert.match(healthCode, /farmLocation\.detectedAddress/);
    assert.match(healthCode, /farmLocation\.landmark/);
    assert.match(healthCode, /farmLocation\.latitude/);
    assert.match(healthCode, /Get Directions/);
    assert.match(healthCode, /Accept & Set Visit/);
    assert.doesNotMatch(
      healthCode,
      /Contact details and exact farm directions become available|Claim request/i,
    );
  });

  await t.test("AI and Health use the same major information hierarchy", () => {
    for (const code of [aiCode, healthCode]) {
      const farmer = code.indexOf("Farmer & Location");
      const animal = code.indexOf("\n            Animal\n");
      const request = code.indexOf("\n            Request Details\n");
      const attachments = code.indexOf("\n            Attachments\n");
      const submitted = code.indexOf("Submitted ${submittedAt}");
      assert.ok(farmer >= 0);
      assert.ok(animal > farmer);
      assert.ok(request > animal);
      assert.ok(attachments > request);
      assert.ok(submitted > attachments);
    }
  });

  await t.test("unclaimed Health is available without broken schedule placeholders", () => {
    assert.match(healthCode, /label: "Available"/);
    assert.match(healthCode, /Visit not scheduled/);
    assert.match(healthCode, /request\?\.farmerName/);
    assert.match(healthCode, /request\?\.barangay/);
    assert.match(healthCode, /request\?\.municipality/);
    assert.doesNotMatch(healthCode, /Scheduled Date: N\/A|Phone: N\/A|Farmer: N\/A/);
  });

  await t.test("Health accepts then schedules with recoverable partial failure", () => {
    const claimIndex = healthCode.indexOf(
      'await claimTechnicianRequest(api, "health", requestId)',
    );
    const scheduleIndex = healthCode.indexOf(
      'await updateRequestStatus(api, "health", requestId',
    );
    assert.ok(claimIndex >= 0);
    assert.ok(scheduleIndex > claimIndex);
    assert.match(healthCode, /let claimSucceeded = false/);
    assert.match(healthCode, /claimSucceeded = true/);
    assert.match(
      healthCode,
      /Request accepted, but the visit could not be scheduled\. Set the visit to continue\./,
    );
    assert.match(healthCode, /Needs scheduling/);
    assert.doesNotMatch(healthCode, /rollback|rollBack|unclaim/i);
  });

  await t.test("Health uses compact canonical scheduling", () => {
    assert.match(healthCode, /<HealthVisitScheduleModal/);
    assert.doesNotMatch(healthCode, /<DateTimePicker/);
    assert.match(healthModalCode, /formatLocalCalendarDate\(selectedDate\)/);
    assert.match(healthModalCode, /"Accept & Schedule"/);
    assert.doesNotMatch(healthModalCode, /preferredDate|preferredTime|12:00 PM/);
  });

  await t.test("Health lifecycle and record routing remain canonical", () => {
    assert.match(healthCode, /"Record Health Assistance"/);
    assert.match(healthCode, /"Continue Health Assistance"/);
    assert.match(healthCode, /"View Health Record"/);
    assert.match(healthCode, /accessibilityLabel="Reschedule"/);
    assert.match(healthCode, /accessibilityLabel="Cancel With Reason"/);
    assert.match(healthCode, /pathname: "\/\(technician\)\/health-log"/);
    assert.match(healthCode, /healthRequestId: requestId/);
    assert.doesNotMatch(healthCode, /Resolve health request/);
  });

  await t.test("Health content normalizes notes and duplicate photos", () => {
    assert.match(healthCode, /Array\.isArray\(value\)/);
    assert.match(healthCode, /new Set\(/);
    assert.match(healthCode, /request\?\.photos, request\?\.imageUrl/);
    assert.match(healthCode, /request\?\.farmerNotes/);
    assert.doesNotMatch(healthCode, /technicianNote \|\| request\?\.farmerNotes/);
  });

  await t.test("dashboard and Open Requests navigate directly to details", () => {
    assert.match(dashboardHookCode, /handleRequestReview: openItemDetails/);
    assert.match(dashboardHookCode, /pathname: "\/\(technician\)\/request-details"/);
    assert.match(dashboardRequestsCode, /Tap to review request/);
    assert.doesNotMatch(dashboardRequestsCode, /Tap to review and claim/);
    assert.match(requestsScreenCode, /pathname: "\/\(technician\)\/request-details"/);
    assert.doesNotMatch(requestsScreenCode, /claimAndScheduleAIRequest|claimTechnicianRequest/);
    assert.match(requestCardCode, /isAIRequest \|\| isHealth\s*\? "Review Request"/);
  });

  await t.test("My Work routes back through canonical details", () => {
    assert.match(myWorkCode, /pathname:\s*"\/\(technician\)\/request-details"/);
    assert.doesNotMatch(myWorkCode, /pathname:\s*"\/\(technician\)\/record-ai"/);
  });
});

test("H4 Farmer visit schedule presentation", async (t) => {
  const presentationCode = read(
    "features",
    "farmer-requests",
    "utils",
    "requestDetailPresentation.ts",
  );
  const aiDetailCode = read("app", "(farmer)", "ai-request-detail.tsx");
  const healthDetailCode = read(
    "app",
    "(farmer)",
    "health-request-detail.tsx",
  );
  const dashboardCode = read(
    "features",
    "farmer-dashboard",
    "screens",
    "FarmerHomeScreen.tsx",
  );
  const dashboardTransformCode = read(
    "features",
    "farmer-dashboard",
    "utils",
    "farmerDashboard.transforms.ts",
  );
  const myRequestsCode = read("app", "(farmer)", "my-requests.tsx");
  const roleAwareAnimalDetailsCode = read(
    "features",
    "animals",
    "screens",
    "RoleAwareAnimalDetailsScreen.tsx",
  );
  const reportPreviewCode = read("app", "(farmer)", "ai-report-preview.tsx");
  const reportPdfCode = read(
    "features",
    "farmer-reports",
    "utils",
    "reportPdfGenerator.ts",
  );

  await t.test("shared formatter returns date plus canonical period", () => {
    const { formatVisitSchedule } = loadTypeScriptModule(
      "features",
      "farmer-requests",
      "utils",
      "requestDetailPresentation.ts",
    );
    const neutralAnchor = "2026-08-08T04:00:00.000Z";

    assert.equal(
      formatVisitSchedule(neutralAnchor, "morning"),
      "Aug 8, 2026 · Morning",
    );
    assert.equal(
      formatVisitSchedule(neutralAnchor, "AFTERNOON"),
      "Aug 8, 2026 · Afternoon",
    );
    assert.equal(formatVisitSchedule(neutralAnchor, null), "Aug 8, 2026");
    assert.equal(formatVisitSchedule(null, "morning"), null);
    assert.doesNotMatch(
      [
        formatVisitSchedule(neutralAnchor, "morning"),
        formatVisitSchedule(neutralAnchor, "afternoon"),
        formatVisitSchedule(neutralAnchor, null),
      ].join(" "),
      /12:00 PM|8:00 AM|1:00 PM/,
    );
    assert.doesNotMatch(presentationCode, /hour:|minute:|h:mm/);
  });

  await t.test("AI and Health details share canonical schedule copy", () => {
    for (const code of [aiDetailCode, healthDetailCode]) {
      assert.match(
        code,
        /formatVisitSchedule\(\s*request\.scheduledDate,\s*request\.visitPeriod,?\s*\)/,
      );
      assert.match(code, /Legacy preferred date/);
      assert.doesNotMatch(
        code,
        /formatRequestDateTime\(request\.scheduledDate[\s\S]{0,120}h:mm/,
      );
    }
    assert.match(
      aiDetailCode,
      /getFarmerAINextStepMessage\(status, visitSchedule\)/,
    );
    assert.match(
      healthDetailCode,
      /scheduled for \$\{scheduledDate\}/,
    );
  });

  await t.test("Upcoming Visits shows Morning or Afternoon, not anchor time", () => {
    assert.match(dashboardCode, /formatVisitPeriod\(visit\.visitPeriod\)/);
    assert.match(dashboardCode, /timeStr=\{visitPeriod \|\| undefined\}/);
    assert.match(
      dashboardCode,
      /formatVisitSchedule\(\s*visit\.scheduledDate,\s*visit\.visitPeriod,?\s*\)/,
    );
    assert.doesNotMatch(
      dashboardCode,
      /timeStr=\{format\(new Date\(visit\.scheduledDate\), "h:mm a"\)\}/,
    );
  });

  await t.test("My Requests formats scheduled AI and Health consistently", () => {
    assert.match(
      myRequestsCode,
      /formatVisitSchedule\(\s*req\.scheduledDate,\s*req\.visitPeriod,?\s*\)/,
    );
    assert.match(myRequestsCode, /Scheduled for \{scheduledVisit\}/);
    assert.match(
      myRequestsCode,
      /Legacy preferred date: \{legacyPreferredDate\}/,
    );
    assert.doesNotMatch(
      myRequestsCode,
      /format\(new Date\(req\.(?:scheduledDate|preferredDate)\),\s*"[^"]*h:mm a"\)/,
    );
    assert.match(myRequestsCode, /req\.symptoms/);
    assert.match(myRequestsCode, /req\.farmerNotes/);
    assert.doesNotMatch(myRequestsCode, /via\.placeholder\.com|attemptNumber \|\| 1/);
  });

  await t.test("Animal Details preserves visit periods and same-day visits", () => {
    const { isVisitTodayOrLater } = loadTypeScriptModule(
      "features",
      "farmer-requests",
      "utils",
      "requestDetailPresentation.ts",
    );

    assert.equal(
      isVisitTodayOrLater(
        "2026-08-08T04:00:00.000Z",
        new Date("2026-08-08T10:00:00.000Z"),
      ),
      true,
    );
    assert.equal(
      isVisitTodayOrLater(
        "2026-08-07T04:00:00.000Z",
        new Date("2026-08-08T00:00:00.000Z"),
      ),
      false,
    );
    assert.match(roleAwareAnimalDetailsCode, /visitPeriod: item\.visitPeriod/);
    assert.match(roleAwareAnimalDetailsCode, /formatVisitSchedule/);
    assert.match(roleAwareAnimalDetailsCode, /isVisitTodayOrLater/);
    assert.doesNotMatch(
      roleAwareAnimalDetailsCode,
      /formatDate\(nextVisit\.scheduledDate, true\)|scheduledAt > Date\.now\(\)/,
    );
  });

  await t.test("report preview and PDF do not re-expose the clock anchor", () => {
    for (const code of [reportPreviewCode, reportPdfCode]) {
      assert.match(code, /formatVisitSchedule/);
      assert.match(code, /visitPeriod/);
      assert.match(code, /Legacy [Pp]referred [Dd]ate/);
    }
    assert.doesNotMatch(
      reportPreviewCode,
      /Scheduled visit", formatDateTime\(details\.scheduledDate\)/,
    );
    assert.doesNotMatch(
      reportPdfCode,
      /Scheduled Visit", formatReportDate\(record\.details\?\.scheduledDate\)/,
    );
  });

  await t.test("dashboard transform preserves canonical scheduling fields", () => {
    assert.match(dashboardTransformCode, /\.map\(\(request\) => \(\{\s*\.\.\.request,/);
    assert.match(dashboardTransformCode, /Boolean\(request\.scheduledDate\)/);
    assert.doesNotMatch(dashboardTransformCode, /h:mm|toLocaleTimeString/);
  });
});

test("H4 Farmer AI lifecycle and combined request filters", async (t) => {
  const presentationCode = read(
    "features",
    "farmer-requests",
    "utils",
    "requestDetailPresentation.ts",
  );
  const aiDetailCode = read("app", "(farmer)", "ai-request-detail.tsx");
  const myRequestsCode = read("app", "(farmer)", "my-requests.tsx");
  const presentation = loadTypeScriptModule(
    "features",
    "farmer-requests",
    "utils",
    "requestDetailPresentation.ts",
  );

  await t.test("AI statuses use the four Farmer-facing lifecycle labels", () => {
    assert.equal(presentation.getFarmerAIStatusLabel("pending"), "Submitted");
    assert.equal(presentation.getFarmerAIStatusLabel("scheduled"), "Scheduled");
    assert.equal(
      presentation.getFarmerAIStatusLabel("in-progress"),
      "In Progress",
    );
    assert.equal(
      presentation.getFarmerAIStatusLabel("in_progress"),
      "In Progress",
    );
    assert.equal(presentation.getFarmerAIStatusLabel("done"), "Completed");
    assert.equal(
      presentation.getFarmerAIStatusLabel("approved"),
      "Scheduling Pending",
    );
  });

  await t.test("Approved is not a primary AI progress milestone", () => {
    const stagesCode = aiDetailCode.slice(
      aiDetailCode.indexOf("const stages"),
      aiDetailCode.indexOf("const getAdditionalNotesOnly"),
    );
    assert.match(stagesCode, /Submitted/);
    assert.match(stagesCode, /Scheduled/);
    assert.match(stagesCode, /In Progress/);
    assert.match(stagesCode, /Completed/);
    assert.doesNotMatch(stagesCode, /Approved/);
    assert.equal(presentation.getFarmerAIProgressIndex("approved"), 0);
    assert.equal(presentation.getFarmerAIProgressIndex("scheduled"), 1);
    assert.equal(presentation.getFarmerAIProgressIndex("in-progress"), 2);
    assert.equal(presentation.getFarmerAIProgressIndex("done"), 3);
  });

  await t.test("What Happens Next is status-aware and never formats the noon anchor", () => {
    const schedule = presentation.formatVisitSchedule(
      "2026-08-08T04:00:00.000Z",
      "afternoon",
    );
    assert.equal(schedule, "Aug 8, 2026 · Afternoon");
    assert.equal(
      presentation.getFarmerAINextStepMessage("scheduled", schedule),
      "Your AI visit is scheduled for Aug 8, 2026 · Afternoon. Please make sure the animal is accessible for the technician.",
    );
    assert.equal(
      presentation.getFarmerAINextStepMessage("in-progress", schedule),
      "The technician has started the AI service.",
    );
    assert.match(
      presentation.getFarmerAINextStepMessage("done", schedule),
      /completed.*next reproductive milestone/i,
    );
    assert.doesNotMatch(
      presentation.getFarmerAINextStepMessage("scheduled", schedule),
      /12:00 PM/,
    );
    assert.match(aiDetailCode, /const visitSchedule = formatVisitSchedule/);
    assert.doesNotMatch(aiDetailCode, /ReproductionNextActionCard/);
    assert.doesNotMatch(
      aiDetailCode,
      /format\([^\n]*request\.scheduledDate[^\n]*h:mm/,
    );
  });

  await t.test("missing visit period remains date-only", () => {
    const schedule = presentation.formatVisitSchedule(
      "2026-08-08T04:00:00.000Z",
      null,
    );
    assert.equal(schedule, "Aug 8, 2026");
    assert.doesNotMatch(
      presentation.getFarmerAINextStepMessage("scheduled", schedule),
      /\d{1,2}:\d{2}\s*(?:AM|PM)/,
    );
  });

  await t.test("combined request filters use Farmer terminology and canonical queries", () => {
    for (const label of [
      "All",
      "Pending",
      "Scheduled",
      "In Progress",
      "Completed",
      "Pending Cancellation",
    ]) {
      assert.match(myRequestsCode, new RegExp(`label: "${label}"`));
    }
    assert.doesNotMatch(myRequestsCode, /label: "Approved"/);
    assert.doesNotMatch(myRequestsCode, /label: "Resolved"/);
    assert.equal(
      presentation.mapFarmerRequestFilterStatus("ai", "completed"),
      "done",
    );
    assert.equal(
      presentation.mapFarmerRequestFilterStatus("health", "completed"),
      "resolved",
    );
    assert.equal(
      presentation.mapFarmerRequestFilterStatus("ai", "in-progress"),
      "all",
    );
    assert.match(myRequestsCode, /\["in-progress", "in_progress"\]/);
  });

  await t.test("legacy accepted records remain readable under All", () => {
    assert.equal(
      presentation.mapFarmerRequestFilterStatus("ai", "all"),
      "all",
    );
    assert.equal(
      presentation.getFarmerRequestListStatusLabel("approved"),
      "Scheduling Pending",
    );
    assert.match(presentationCode, /approved", "assigned", "triaged/);
    assert.match(myRequestsCode, /getFarmerRequestListStatusLabel/);
  });
});

test("H4 Farmer official Health record presentation", async (t) => {
  const serviceCode = read(
    "features",
    "farmer-reports",
    "services",
    "farmerReports.service.ts",
  );
  const detailCode = read(
    "features",
    "farmer-reports",
    "components",
    "RecordDetailContent.tsx",
  );
  const animalDetailCode = read("app", "(farmer)", "animal-record-detail.tsx");
  const {
    getFarmerOfficialRecords,
    mapHealthMedicalRecordDetails,
  } = loadTypeScriptModule(
    "features",
    "farmer-reports",
    "services",
    "farmerReports.service.ts",
  );

  await t.test("request-linked records combine request context with clinical outcome", () => {
    const details = mapHealthMedicalRecordDetails(
      {
        type: "Treatment",
        date: "2026-08-08T04:00:00.000Z",
        createdAt: "2026-08-08T05:00:00.000Z",
        healthRequestId: {
          requestType: "loss_of_appetite",
          symptoms: "Weakness and low appetite",
          urgency: "medium",
          farmerNotes: "Stopped eating yesterday",
          advice: "Provide clean water and continue observation",
          followUpDate: "2026-08-12T04:00:00.000Z",
        },
        details: {
          diagnosis: "Bacterial infection",
          treatment: "Antibiotic treatment",
          medicineName: "Oxytetracycline",
          dosage: "10 mL",
          withdrawalPeriodDays: 7,
          withdrawalEndDate: "2026-08-15T04:00:00.000Z",
        },
      },
      {
        technicianId: { name: "Juan Dela Cruz" },
        recordDate: "2026-08-08T04:00:00.000Z",
      },
    );

    assert.equal(details.requestType, "Loss Of Appetite");
    assert.equal(details.symptoms, "Weakness and low appetite");
    assert.equal(details.urgency, "Medium");
    assert.equal(details.farmerNotes, "Stopped eating yesterday");
    assert.equal(details.diagnosis, "Bacterial infection");
    assert.equal(details.treatment, "Antibiotic treatment");
    assert.equal(details.medicine, "Oxytetracycline");
    assert.equal(details.dosage, "10 mL");
    assert.equal(details.advice, "Provide clean water and continue observation");
    assert.equal(details.followUpDate, "Aug 12, 2026");
    assert.equal(details.withdrawalPeriod, "7 days");
    assert.equal(details.withdrawalEndDate, "Aug 15, 2026");
    assert.equal(details.technician, "Juan Dela Cruz");
  });

  await t.test("walk-in records keep clinical fields and omit request-only values", () => {
    const details = mapHealthMedicalRecordDetails(
      {
        type: "Check-up",
        details: {
          diagnosis: "Mild dehydration",
          treatment: "Oral fluids",
        },
        note: "Keep water available",
      },
      { technicianId: { name: "Tech Ana" } },
    );

    assert.equal(details.requestType, "Check Up");
    assert.equal(details.diagnosis, "Mild dehydration");
    assert.equal(details.treatment, "Oral fluids");
    assert.equal(details.advice, "Keep water available");
    assert.equal(details.technician, "Tech Ana");
    assert.equal(details.symptoms, undefined);
    assert.equal(details.urgency, undefined);
    assert.equal(details.farmerNotes, undefined);
  });

  await t.test("official Health records are enriched without relabeling General Notes", async () => {
    const response = await getFarmerOfficialRecords(
      {
        get: async () => ({
          data: {
            data: [
              {
                id: "medical-1",
                category: "Health",
                title: "Treatment",
                source: {
                  type: "Treatment",
                  healthRequestId: { symptoms: "Weakness" },
                  details: { diagnosis: "Infection" },
                },
              },
              {
                id: "note-1",
                category: "General Note",
                title: "General Note",
                source: { type: "General Note", note: "Monitor appetite" },
              },
            ],
            total: 2,
          },
        }),
      },
    );

    assert.equal(response.data[0].title, "Health Assistance");
    assert.equal(response.data[0].details.symptoms, "Weakness");
    assert.equal(response.data[0].details.diagnosis, "Infection");
    assert.equal(response.data[1].title, "General Note");
  });

  await t.test("Health rows are conditional and use readable labels", () => {
    const healthSection = detailCode.slice(
      detailCode.indexOf('selectedActivity.type === "health"'),
      detailCode.indexOf('selectedActivity.type === "calving"'),
    );
    for (const label of [
      "Concern / Symptoms",
      "Diagnosis",
      "Treatment",
      "Medicine",
      "Dosage",
      "Advice",
      "Follow-up",
      "Withdrawal Period",
      "Technician",
    ]) {
      assert.match(healthSection, new RegExp(`label="${label}"`));
    }
    assert.match(healthSection, /hasDisplayValue/);
    assert.doesNotMatch(healthSection, /N\/A|Medicine \/ Advice/);
  });

  await t.test("Records detail reuses the canonical Health mapper", () => {
    assert.match(serviceCode, /mapHealthMedicalRecordDetails\(source, record\)/);
    assert.match(animalDetailCode, /mapHealthMedicalRecordDetails\(record,/);
    assert.match(animalDetailCode, /const isMedicalRecord/);
  });
});

test("technician route and task details preserve canonical visit context", async (t) => {
  const route = read(
    "features",
    "technician-dashboard",
    "components",
    "TechnicianRouteSection.tsx",
  );
  const taskDetails = read("app", "(technician)", "task-details.tsx");
  const workPresentation = read(
    "features",
    "technician-requests",
    "utils",
    "requestWorkPresentation.ts",
  );
  const dashboardController = readRepository(
    "backend",
    "src",
    "controllers",
    "technician.controllers.js",
  );
  const taskController = readRepository(
    "backend",
    "src",
    "controllers",
    "tasks.controllers.js",
  );

  await t.test("route rows show Morning or Afternoon without deriving a clock time", () => {
    assert.match(route, /item\.timingLabel/);
    assert.doesNotMatch(route, /item\.raw/);
    assert.match(workPresentation, /item\.raw\?\.visitPeriod/);
    assert.match(workPresentation, /period === "morning" \? "Morning" : "Afternoon"/);
    assert.doesNotMatch(route, /toLocaleTimeString/);
    assert.match(dashboardController, /visitPeriod: ins\.visitPeriod \|\| null/);
    assert.match(
      dashboardController,
      /visitPeriod: healthRequest\.visitPeriod \|\| null/,
    );
  });

  await t.test("pregnancy and calving task details show linked clinical context", () => {
    assert.match(taskDetails, /Pregnancy Check Details/);
    assert.match(taskDetails, /Calving & Pregnancy Details/);
    assert.match(taskDetails, /"Expected calving"/);
    assert.match(taskDetails, /"Pregnancy confirmed"/);
    assert.match(taskDetails, /"AI service date"/);
    assert.match(taskDetails, /params\.pregnancyId = String\(pregnancyId\)/);
    assert.match(taskController, /taskObj\.pregnancy = pregnancy \|\| null/);
    assert.match(
      taskController,
      /taskObj\.insemination = pregnancy\?\.inseminationId \|\| null/,
    );
  });
});

test("Dashboard and My Work share normalized technician work semantics", () => {
  const presentation = loadTypeScriptModule(
    "features",
    "technician-requests",
    "utils",
    "requestWorkPresentation.ts",
  );
  const hook = read(
    "features",
    "technician-dashboard",
    "hooks",
    "useTechnicianDashboardScreen.ts",
  );
  const screen = read(
    "features",
    "technician-dashboard",
    "screens",
    "TechnicianDashboardScreen.tsx",
  );
  const now = new Date("2026-08-08T10:00:00.000Z");
  const base = {
    id: "work-1",
    workflowId: "workflow-1",
    taskId: null,
    status: "scheduled",
    farmer: { name: "Farmer One", location: "Oton" },
    animal: { name: "Bessie", earTag: "C-01" },
    allowedAction: "RECORD_SERVICE",
  };

  assert.match(hook, /useTechnicianTasks\(undefined, \{/);
  assert.match(hook, /normalizeTechnicianWorkItems/);
  assert.match(screen, /TechnicianStatsCard loading=\{workLoading\} workItems=\{workItems\}/);
  assert.match(screen, /workItems=\{todayWorkItems\}/);

  const ai = presentation.normalizeTechnicianWorkItem(
    {
      ...base,
      workflowType: "AI",
      schedule: { date: "2026-08-08T04:00:00.000Z", visitPeriod: "morning" },
    },
    now,
  );
  const health = presentation.normalizeTechnicianWorkItem(
    {
      ...base,
      id: "health-1",
      workflowType: "Health",
      schedule: { date: "2026-08-08T04:00:00.000Z", visitPeriod: null },
      raw: { visitPeriod: "afternoon" },
    },
    now,
  );
  assert.equal(ai.isReadyToday, true);
  assert.equal(ai.timingLabel, "Aug 8, 2026 · Morning");
  assert.equal(health.timingLabel, "Aug 8, 2026 · Afternoon");

  const pregnancy = presentation.normalizeTechnicianWorkItem(
    {
      ...base,
      workflowId: null,
      taskId: "pd-1",
      workflowType: "PD",
      taskType: "PD",
      schedule: { date: "2026-08-08T04:00:00.000Z", visitPeriod: null },
      raw: { dueDate: "2026-08-08T04:00:00.000Z" },
    },
    now,
  );
  assert.equal(pregnancy.timingKind, "confirmation_due");
  assert.equal(pregnancy.statusLabel, "Needs confirmation");
  assert.doesNotMatch(`${pregnancy.timingLabel} ${pregnancy.statusLabel}`, /Morning|Afternoon|Scheduled/);

  const calving = presentation.normalizeTechnicianWorkItem(
    {
      ...base,
      workflowId: null,
      taskId: "calving-1",
      workflowType: "Calving",
      taskType: "CD",
      schedule: { date: "2026-08-07T04:00:00.000Z", visitPeriod: null },
      raw: { dueDate: "2026-08-07T04:00:00.000Z" },
    },
    now,
  );
  assert.equal(calving.statusLabel, "Monitoring");
  assert.match(calving.timingLabel, /^Past expected date/);
  assert.equal(calving.needsAttention, true);
  assert.equal(calving.overdue, false);

  for (const workflowType of ["AI", "Health"]) {
    const unscheduled = presentation.normalizeTechnicianWorkItem(
      {
        ...base,
        workflowType,
        status: "approved",
        schedule: { date: null, visitPeriod: null },
      },
      now,
    );
    assert.equal(unscheduled.state, "needs_scheduling");
    assert.equal(unscheduled.actionLabel, "Set Visit");
  }

  const metrics = presentation.summarizeTechnicianWork(
    presentation.normalizeTechnicianWorkItems(
      [
        { ...base, workflowType: "AI", schedule: { date: "2026-08-08T04:00:00.000Z", visitPeriod: "morning" } },
        { ...base, id: "old", workflowType: "Health", schedule: { date: "2026-08-07T04:00:00.000Z", visitPeriod: "afternoon" } },
        { ...base, id: "done", workflowType: "AI", status: "done", completedAt: "2026-08-08T03:00:00.000Z", schedule: { date: null, visitPeriod: null } },
        { ...base, id: "cancelled", workflowType: "Health", status: "cancelled", schedule: { date: "2026-08-08T04:00:00.000Z", visitPeriod: "morning" } },
      ],
      now,
    ),
    now,
  );
  assert.deepEqual(metrics, {
    dueToday: 1,
    needsAttention: 1,
    completedToday: 1,
  });

  const reInsemination = presentation.normalizeTechnicianWorkItem(
    {
      ...base,
      id: "attempt-2",
      workflowType: "AI",
      attemptNumber: 2,
      previousAttemptId: "attempt-1",
      previousAttemptOutcome: "Failed (Re-heat)",
      previousAttemptVerified: true,
      schedule: { date: "2026-08-08T04:00:00.000Z", visitPeriod: "morning" },
    },
    now,
  );
  assert.equal(reInsemination.requestKind, "re_insemination");
  assert.equal(reInsemination.title, "Re-insemination");
  assert.equal(reInsemination.attemptNumber, 2);
  assert.equal(reInsemination.previousAttemptId, "attempt-1");
  assert.equal(reInsemination.previousAttemptVerified, true);
  assert.equal(presentation.normalizeServiceType(reInsemination), "ai");

  const unverified = presentation.normalizeTechnicianWorkItem(
    {
      ...base,
      id: "attempt-2-unverified",
      workflowType: "AI",
      attemptNumber: 2,
      previousAttemptOutcome: "Failed (Re-heat)",
      previousAttemptVerified: false,
      schedule: { date: "2026-08-08T04:00:00.000Z", visitPeriod: "morning" },
    },
    now,
  );
  assert.equal(unverified.previousAttemptVerified, false);
});

test("Farmer Needs Attention follows the canonical reproduction lifecycle", async (t) => {
  const home = read(
    "features",
    "farmer-dashboard",
    "screens",
    "FarmerHomeScreen.tsx",
  );
  const transforms = read(
    "features",
    "farmer-dashboard",
    "utils",
    "farmerDashboard.transforms.ts",
  );
  const observation = read(
    "features",
    "breeding",
    "screens",
    "BreedingObservationScreen.tsx",
  );
  const milestonesController = readRepository(
    "backend",
    "src",
    "controllers",
    "user.controllers.js",
  );
  const aiController = readRepository(
    "backend",
    "src",
    "controllers",
    "ai-request.controllers.js",
  );

  await t.test("breeding follow-up opens the observation screen, never a diagnosis mutation", () => {
    assert.match(transforms, /displayTitle = "Breeding Follow-up"/);
    assert.match(transforms, /"Report Signs"/);
    assert.match(home, /pathname: "\/\(farmer\)\/report-breeding-observation"/);
    assert.match(home, /requestId: item\.relatedId/);
    assert.doesNotMatch(home, /Confirm Pregnant|confirmPregnancy/);
  });

  await t.test("pregnancy confirmation copy consumes backend readiness and reuses task state", () => {
    assert.match(milestonesController, /getPregnancyCheckReadiness/);
    assert.match(milestonesController, /taskForInsemination/);
    assert.match(aiController, /Task\.findOne\(\{/);
    assert.match(aiController, /"metadata\.inseminationId": request\._id/);
    assert.match(aiController, /request\.verificationTaskId = verificationTask\._id/);
    assert.match(transforms, /milestone\.pregnancyReadiness\?\.isEligible/);
    assert.match(transforms, /Pregnancy check requested/);
    assert.match(transforms, /Awaiting technician confirmation/);
    assert.match(observation, /latestInsemination\?\.pregnancyReadiness/);
    assert.doesNotMatch(observation, /reportType === "return_to_heat" \? 18 : 35/);
  });

  await t.test("calving uses the real pregnancy and animal identifiers only when due", () => {
    assert.match(transforms, /Expected Calving Today/);
    assert.match(transforms, /Past Expected Calving Date/);
    assert.match(home, /pathname: "\/\(farmer\)\/record-calving"/);
    assert.match(home, /pregnancyId: item\.relatedId/);
    assert.match(home, /taskId: item\.taskId \|\| undefined/);
    assert.doesNotMatch(home, /calving.*completed/i);
  });
});

test("Farmer Breeding Observation uses the shared header and optional evidence contract", async (t) => {
  const observation = read(
    "features",
    "breeding",
    "screens",
    "BreedingObservationScreen.tsx",
  );
  const service = read(
    "features",
    "breeding",
    "services",
    "breedingObservation.service.ts",
  );

  await t.test("loading, error, and form states share the canonical Farmer header", () => {
    const headerUsages = observation.match(/<AppPageHeader/g) || [];

    assert.match(observation, /import \{ AppPageHeader \}/);
    assert.ok(headerUsages.length >= 3);
    assert.doesNotMatch(observation, /backgroundColor: "#00643B"/);
    assert.doesNotMatch(observation, /StatusBar barStyle="light-content"/);
    assert.match(observation, /onBack=\{\(\) => safeBack\(\)\}/);
  });

  await t.test("photos reuse the shared picker and reject local-only values", () => {
    assert.match(observation, /pickImageFromSource/);
    assert.match(observation, /PhotoOptionModal/);
    assert.match(observation, /const MAX_EVIDENCE_PHOTOS = 3/);
    assert.match(observation, /handleSelectPhoto\("camera"\)/);
    assert.match(observation, /handleSelectPhoto\("library"\)/);
    assert.match(observation, /removeEvidencePhoto/);
    assert.match(observation, /isPickingPhoto/);
    assert.ok(observation.includes("if (!/^data:image\\/"));
  });

  await t.test("submission keeps the canonical farmer-observation endpoint", () => {
    assert.match(
      observation,
      /evidencePhotos: evidencePhotos\.map\(\(photo\) => photo\.base64\)/,
    );
    assert.match(service, /evidencePhotos\?: string\[\]/);
    assert.match(
      service,
      /`\/ai-request\/\$\{requestId\}\/farmer-observation`/,
    );
    assert.doesNotMatch(service, /\/outcome/);
  });
});
