# Farmer Record Detail Page And AI Report Plan

## Context

BreedSmart currently has good farmer-facing detail pages for health assistance:

- `mobile/app/(farmer)/health-request-detail.tsx`
- `mobile/app/(farmer)/health-report-preview.tsx`

However, the farmer animal history / medical record experience is still inconsistent:

- In `mobile/features/animals/screens/AnimalDetailsScreen.tsx`, records inside the `Medical` tab open inside a large inline modal.
- The modal is doing too much work for AI, calving, and medical records.
- AI service records do not yet have a dedicated farmer-facing report/preview page similar to health reports.
- The backend does correctly link pregnancy checks to the exact AI/insemination record through `inseminationId`, but the mobile UI does not make this relationship clear enough.

The goal is to replace the large record modal with proper record detail pages and add a clear AI service report path.

## Anti-Duplication Rule

Before creating any new page or component, check whether an existing route/component can be reused or refactored.

Existing farmer-side pages/components that must be considered first:

- `mobile/app/(farmer)/ai-request-detail.tsx`
- `mobile/app/(farmer)/health-request-detail.tsx`
- `mobile/app/(farmer)/health-report-preview.tsx`
- `mobile/app/(farmer)/(tabs)/farmer.records.tsx`
- `mobile/features/farmer-reports/screens/FarmerReportsScreen.tsx`
- `mobile/features/farmer-reports/components/RecordDetailModal.tsx`
- `mobile/features/farmer-reports/components/DetailRow.tsx`
- `mobile/features/farmer-reports/components/StatusBadge.tsx`
- `mobile/features/farmer-reports/utils/reportPdfMapper.ts`
- `mobile/features/farmer-reports/hooks/useFarmerReports.ts`

Do not create another detail/report system if one of these can be extracted and reused.

## Current Verified Logic

### Backend AI To Pregnancy Link

The backend already has the important relationship:

- `Insemination` records are created when AI is recorded or requested.
- `Pregnancy` records contain:
  - `animalId`
  - `farmerId`
  - `inseminationId`
- `Pregnancy.inseminationId` is required and unique.
- `POST /api/technician/pregnancy-check` requires:
  - `animalId`
  - `inseminationId`
  - `result`
  - `technicianNote`
- The backend checks that the selected `inseminationId` belongs to the selected animal.
- The backend updates the exact AI attempt outcome:
  - `Pregnant`
  - `Failed (Negative PD)`
- The backend updates animal reproductive status:
  - `Pregnant`
  - `Normal`

This means the architecture is already mostly correct. The missing piece is clearer UI and record navigation.

## Main UX Decision

Replace the record modal in the farmer animal page with a dedicated page, but reuse the existing record-detail rendering logic where possible.

Current:

```ts
setSelectedRecord(record);
setRecordModalVisible(true);
```

Target:

```ts
router.push({
  pathname: "/(farmer)/animal-record-detail",
  params: {
    animalId: animal._id,
    recordId: record._id,
    recordType: record.recordKind || record.type,
  },
});
```

Keep the old modal temporarily during implementation only as fallback. Remove it after the new page passes manual testing.

## Phase 1: Rename And Clarify Farmer Animal Records Tab

### Target

In `mobile/features/animals/screens/AnimalDetailsScreen.tsx`, rename the `Medical` tab label to `Records`.

Reason:

The tab contains more than medical records. It can include health requests, AI records, calving records, and other animal history items.

### Suggested Filters

Replace or evolve the current medical filters into:

- All
- Health
- AI
- Pregnancy
- Calving
- Medicine
- Photos

Do not break existing query behavior during this phase. If backend filtering is not ready, filter client-side for now and document what should move backend-side later.

## Phase 2: Create Farmer Animal Record Detail Route

### Route Decision

Preferred route:

Create:

```txt
mobile/app/(farmer)/animal-record-detail.tsx
```

This route should not duplicate the UI logic from `RecordDetailModal.tsx`. Instead, extract the shared content into a reusable component.

### Required Reuse Refactor

Refactor:

```txt
mobile/features/farmer-reports/components/RecordDetailModal.tsx
```

Into:

```txt
mobile/features/farmer-reports/components/RecordDetailContent.tsx
```

Then make:

- `RecordDetailModal.tsx` render `RecordDetailContent`
- `animal-record-detail.tsx` render the same `RecordDetailContent`

This avoids duplicating AI/health/calving record display logic.

Add it to:

```txt
mobile/app/(farmer)/_layout.tsx
```

### Params

```ts
animalId: string;
recordId: string;
recordType: string;
```

### Data Strategy

Preferred long-term:

- Add a backend endpoint:

```txt
GET /api/animals/:animalId/records/:recordId?type=
```

Preferred first implementation:

- Reuse existing animal record/history data and existing farmer report mapping utilities.
- Check whether `useFarmerReports`, `reportPdfMapper`, or the current Animal Details record list already contains the needed details.
- If the selected record object is already available from the list, pass minimal params and refetch the full animal records list, then find the record by `_id`.

Avoid passing huge serialized record objects through route params.

Do not build a second independent mapper if `RecordDetailModal.tsx` or `reportPdfMapper.ts` already handles the same data shape.

## Phase 3: Record Detail Page Layout

Use one page component that adapts by record type.

### Shared Header

Header should show:

- Back button
- Record type label
- Animal tag / animal ID
- Status badge if available

### AI / Insemination Record Detail

Show:

- Animal identity
- Farmer name
- AI date
- Attempt number
- Technician name
- Sire breed
- Sire code
- Estrus type
- Notes / comments
- Outcome
- Linked pregnancy check result if available
- Expected calving date if pregnant

Actions:

- `Preview AI Report` if the record is complete
- `View Pregnancy Tracker` if linked pregnancy exists or animal is pregnant

### Health Record Detail

Show:

- Request type
- Symptoms
- Urgency
- Photos
- Assigned technician
- Scheduled date
- Findings
- Diagnosis
- Treatment
- Medicine
- Dosage
- Follow-up date
- Resolution

Actions:

- `Preview Health Report`

### Pregnancy Record Detail

Show:

- Linked AI attempt
- Diagnosis date
- Result
- Technician notes
- Target calving date
- Current pregnancy stage

Actions:

- `View Pregnancy Tracker`

### Calving Record Detail

Show:

- Mother
- Calving date
- Delivery outcome / calving ease
- Number of offspring
- Offspring list
- Technician notes

Actions:

- Open offspring animal profile if offspring IDs exist

## Phase 4: Add Farmer AI Report Preview

### Route Decision

Do not automatically create a new route if `health-report-preview.tsx` can be generalized cleanly.

Preferred approach:

1. Extract the shared report preview layout/PDF generation into reusable helpers/components.
2. Create a generic report preview route only if it stays simple:

```txt
mobile/app/(farmer)/record-report-preview.tsx
```

Params:

```ts
recordType: "health" | "ai" | "pregnancy" | "calving";
id: string;
animalId?: string;
```

Alternative if the generic route becomes too complex:

```txt
mobile/app/(farmer)/ai-report-preview.tsx
```

Do not duplicate the whole `health-report-preview.tsx` file and only change labels. Extract shared report functions first.

Add whichever route is chosen to:

```txt
mobile/app/(farmer)/_layout.tsx
```

### Report Content

The AI report should include:

- BreedSmart header
- Animal information
- Farmer information
- Technician information
- AI service date
- Attempt number
- Sire breed
- Sire code
- Estrus type
- Heat signs if available
- Technician note
- Outcome
- Pregnancy diagnosis result if available
- Expected calving date if pregnant

### PDF Rules

Use the same safety approach as health report:

- Escape dynamic HTML values.
- Do not use hardcoded `Oton` wording.
- Use province/municipality-neutral wording such as `Iloilo Livestock Breeding Record`.
- Include a disclaimer:

```txt
Generated from BreedSmart. This report documents recorded artificial insemination service and follow-up outcomes.
```

### Reuse Requirements

Reuse or extract from:

- `mobile/app/(farmer)/health-report-preview.tsx`
- `mobile/features/farmer-reports/utils/reportPdfMapper.ts`
- `mobile/features/farmer-reports/components/DetailRow.tsx`

If adding `ai-report-preview.tsx`, keep it thin and move shared PDF escaping/report row logic into a utility.

## Phase 5: Technician Pregnancy Check UI Clarity

The pregnancy check screen already sends the selected `inseminationId`.

File:

```txt
mobile/app/(technician)/pregnancy-check.tsx
```

Improve the selected AI attempt UI so technicians clearly understand what record they are updating.

Add a `Linked AI Attempt` card after selecting the animal and AI attempt.

Show:

- Attempt number
- AI date
- Days since AI
- Sire code
- Sire breed
- AI technician if available
- Current outcome: Pending

Suggested copy:

```txt
This diagnosis will update AI Attempt #2 from July 9, 2026. The result will be permanently linked to this AI service record.
```

If the selected AI is too recent:

```txt
Only 12 days since AI. Pregnancy diagnosis may be too early. Recommended check is 35+ days for ultrasound or 60+ days for palpation.
```

Do not block the technician yet unless backend policy is also updated. For now, show a warning and require confirmation if too early.

## Phase 6: Backend Safety Checks

Review and strengthen:

```txt
POST /api/technician/pregnancy-check
```

Confirm or add:

- `inseminationId` must belong to `animalId`.
- `inseminationId` must not already have a pregnancy record.
- AI outcome must still be `Pending`.
- Animal must not already be `Pregnant`.
- If AI date is too recent, return a clear warning or require an override reason.

Recommended future shape:

```json
{
  "animalId": "...",
  "inseminationId": "...",
  "result": "Pregnant",
  "technicianNote": "...",
  "overrideReason": "..."
}
```

## Phase 7: Notification And Farmer Visibility

When a pregnancy check updates an AI attempt:

- Farmer should receive a notification.
- Notification should open either:
  - pregnancy record detail, or
  - AI record detail with linked pregnancy result.

Avoid sending the farmer to a generic request page if the event is now an official service record.

## Acceptance Criteria

- Farmer animal `Medical` tab is renamed or presented as `Records`.
- Clicking a record opens a full detail page instead of the large modal.
- The new detail page reuses extracted content from `RecordDetailModal.tsx`.
- The old modal is not duplicated into another large component.
- AI records have a proper detail view.
- AI records have a PDF/share preview similar to health reports, using shared report utilities where practical.
- Technician pregnancy check screen clearly shows the linked AI attempt.
- Pregnancy check still submits the exact selected `inseminationId`.
- Backend rejects duplicate pregnancy checks for the same AI attempt.
- Farmer can see how AI service led to pregnancy confirmation.
- No hardcoded `Oton` wording is added.

## Antigravity Implementation Prompt

Read this file first:

```txt
docs/farmer-record-detail-and-ai-report-plan.md
```

Implement the plan in small safe phases.

Start with Phase 1 and Phase 2:

1. Rename the farmer Animal Details `Medical` tab to `Records`.
2. Inspect `mobile/features/farmer-reports/components/RecordDetailModal.tsx`.
3. Extract the reusable record body into `RecordDetailContent.tsx`.
4. Update `RecordDetailModal.tsx` to use `RecordDetailContent`.
5. Create `mobile/app/(farmer)/animal-record-detail.tsx` and reuse `RecordDetailContent`.
6. Wire record cards in `mobile/features/animals/screens/AnimalDetailsScreen.tsx` to navigate to the new detail page instead of opening the large modal.
7. Keep the old modal temporarily as fallback, but do not use it from the main record card press.
8. Preserve current data behavior and do not change backend contracts unless required.
9. Run:

```txt
cd mobile
npx tsc --noEmit --pretty false
```

After Phase 1 and 2 pass, continue with:

10. Add AI record-specific sections to the shared detail content if missing.
11. Decide whether to generalize `health-report-preview.tsx` into `record-report-preview.tsx` or create a thin `ai-report-preview.tsx`.
12. Reuse shared report/PDF helpers and avoid copying the health report file wholesale.
13. Improve `mobile/app/(technician)/pregnancy-check.tsx` with a clear `Linked AI Attempt` card.
14. Only then review backend safety checks for pregnancy check duplicate/early diagnosis handling.

Do not rewrite the entire Animal Details screen. Keep changes scoped and preserve existing farmer workflows.
