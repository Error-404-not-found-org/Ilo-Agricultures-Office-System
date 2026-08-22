import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("Farmer My Requests keeps Health responses request-oriented", () => {
  const requests = source("mobile/app/(farmer)/my-requests.tsx");

  assert.match(requests, /Health Advice/);
  assert.match(requests, /Office Pickup/);
  assert.match(requests, /View Response/);
  assert.doesNotMatch(requests, /pathname: "\/\(farmer\)\/health-report-preview"/);
});

test("Farmer Health Request detail requires a linked MedicalRecord for reports", () => {
  const detail = source("mobile/app/(farmer)/health-request-detail.tsx");

  assert.match(detail, /request\.medicalRecordId/);
  assert.match(detail, /No official medical record is linked/);
  assert.match(detail, /id: request\.medicalRecordId/);
  assert.match(detail, /HealthRequestResponseSections request=\{request\}/);
});

test("Health report preview reads an official MedicalRecord, never a raw request", () => {
  const report = source("mobile/app/(farmer)/health-report-preview.tsx");

  assert.match(report, /getFarmerOfficialRecordDetail/);
  assert.match(report, /"medical_record"/);
  assert.match(report, /Official Medical Record/);
  assert.doesNotMatch(report, /getHealthRequestDetail|Animal Health Assistance Report/);
});

test("Farmer and Technician official detail routes reject HealthRequest as a record kind", () => {
  const farmerTypes = source(
    "mobile/features/farmer-reports/types/farmerReports.types.ts",
  );
  const farmerDetail = source("mobile/app/(farmer)/animal-record-detail.tsx");
  const technicianDetail = source(
    "mobile/features/technician-records/screens/RecordDetailsScreen.tsx",
  );

  assert.doesNotMatch(farmerTypes, /\| "health_request"/);
  assert.doesNotMatch(farmerDetail, /foundRecord\.sourceKind === "health_request"/);
  assert.doesNotMatch(technicianDetail, /^\s*"health_request",/m);
});

test("Technician Report Studio sources Health rows from official MedicalRecords", () => {
  const service = source(
    "mobile/features/technician-records/services/technicianRecords.service.ts",
  );
  const hook = source(
    "mobile/features/technician-records/hooks/useTechnicianReportData.ts",
  );

  assert.match(service, /getHealthMedicalRecords/);
  assert.match(service, /"\/animals\/records"/);
  assert.match(service, /type: "health"/);
  assert.doesNotMatch(service, /getHealthRequests|`\/health-request\?page=/);
  assert.match(hook, /record\.recordKind !== "medical_record"/);
  assert.doesNotMatch(hook, /sources\.healthRequests/);
});

test("Technician completed-work presentation defaults legacy Health to response history", () => {
  const workPresentation = source(
    "mobile/features/technician-requests/utils/requestWorkPresentation.ts",
  );
  const requestDetail = source(
    "mobile/features/technician-health-request/components/HealthRequestDetails.tsx",
  );

  assert.match(workPresentation, /hasMedicalRecord/);
  assert.match(workPresentation, /\? "View Record"\s*:\s*"View Response"/);
  assert.match(requestDetail, /isResolved && request\?\.medicalRecordId/);
});

test("Farmer Home routes Health activity back to its request response", () => {
  const home = source(
    "mobile/features/farmer-dashboard/screens/FarmerHomeScreen.tsx",
  );
  const transform = source(
    "mobile/features/farmer-dashboard/utils/farmerDashboard.transforms.ts",
  );

  assert.match(home, /item\.type === "health"/);
  assert.match(home, /pathname: "\/\(farmer\)\/health-request-detail"/);
  assert.match(transform, /Health advice/);
  assert.match(transform, /Office pickup/);
  assert.match(transform, /Health request/);
});
