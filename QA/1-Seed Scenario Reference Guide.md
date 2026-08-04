# BreedSmart RC26 Seed Scenario Reference Guide

## Document information

| Field | Value |
| --- | --- |
| Seeder | `backend/scripts/seed-reproduction-lifecycle.js` |
| Scenario prefix | `RC26-` |
| Scenario count | 16 |
| Environment | Development/test only |
| Seeder owner | QA Lead |
| Seed execution date | `TBD` |
| Manifest path | `TBD — record the exact generated path` |

## Purpose

These scenarios provide controlled reproduction states that would otherwise require weeks or months to reach. They are snapshots for focused testing, not one animal moving through an entire lifecycle.

The seeder requires an existing Farmer account and Technician account. It writes an exact cleanup manifest before inserting records.

## Safe seed procedure

From `backend`:

### 1. Dry run

```powershell
cmd.exe /c npm run seed:reproduction-lifecycle -- --farmerEmail=FARMER_EMAIL --technicianEmail=TECHNICIAN_EMAIL
```

Confirm:

- Output says `DRY RUN`.
- Database is the intended development database.
- Farmer and Technician are the approved test accounts.
- Sixteen scenarios are planned.

### 2. Execute once

```powershell
cmd.exe /c npm run seed:reproduction-lifecycle -- --farmerEmail=FARMER_EMAIL --technicianEmail=TECHNICIAN_EMAIL --execute
```

Copy the exact manifest path into the QA Lead tracker. Never replace it with a guessed `TIMESTAMP`.

### 3. Cleanup dry run

```powershell
cmd.exe /c npm run cleanup:reproduction-lifecycle -- --manifest="ACTUAL_MANIFEST_PATH"
```

### 4. Cleanup execution

Only after reviewing the dry-run counts:

```powershell
cmd.exe /c npm run cleanup:reproduction-lifecycle -- --manifest="ACTUAL_MANIFEST_PATH" --execute
```

Cleanup targets only manifest-listed IDs. Never edit the manifest manually.

## Scenario summary

| QA ID | Seed scenario | Initial state | Exact expected outcome |
| --- | --- | --- | --- |
| QA-RC-01 | RC26-01-AVAILABLE | Normal | AI request available |
| QA-RC-02 | RC26-02-AI-PENDING | Pending AI request | Duplicate active AI request rejected |
| QA-RC-03 | RC26-03-AI-SCHEDULED | Scheduled AI visit | Attend scheduled AI visit |
| QA-RC-04 | RC26-04-AI-DAY10 | Inseminated 10 days ago | Monitor return to heat; pregnancy diagnosis blocked |
| QA-RC-05 | RC26-05-AI-DAY21 | Inseminated 21 days ago | Return-to-heat milestone; Farmer observation available |
| QA-RC-06 | RC26-06-LIKELY-PREGNANT | Likely Pregnant at Day 40 | Technician verification required; diagnosis locked before Day 60 |
| QA-RC-07 | RC26-07-PD-DUE | Inseminated 60 days ago | Perform pregnancy diagnosis |
| QA-RC-08 | RC26-08-PREGNANT | Confirmed pregnant | Prepare for expected calving |
| QA-RC-09 | RC26-09-CALVING-DUE | Confirmed pregnant, due today | Calving follow-up due today |
| QA-RC-10 | RC26-10-CALVING-OVERDUE | Confirmed pregnant, five days overdue | Ready for twin or mixed-outcome test |
| QA-RC-11 | RC26-11-POSTPARTUM | Recent live birth | Postpartum recovery; offspring lineage visible |
| QA-RC-12 | RC26-12-STILLBIRTH | Stillbirth recorded | Stillbirth history; zero living offspring |
| QA-RC-13 | RC26-13-ABORTION | Pregnancy loss recorded | Pregnancy-loss recovery; parity unchanged |
| QA-RC-14 | RC26-14-MIXED | One living and one stillborn | Living offspring plus embedded stillborn outcome |
| QA-RC-15 | RC26-15-REHEAT | Verified failed AI, In Heat | Re-insemination available |
| QA-RC-16 | RC26-16-ATTEMPT-2 | Active pending second attempt | Attempt 2 linked to verified failed Attempt 1 |

## Detailed references

### QA-RC-01 — Available for first AI request

Verify:

- Farmer sees the AI request action.
- Request submission succeeds once.
- The resulting request is visible to Technician clients.
- Animal enters the correct active AI-request state.

Primary: Farmer Mobile.

Cross-check: Technician Mobile and Technician Web.

### QA-RC-02 — Duplicate request prevention

Verify:

- A second active AI request is rejected.
- The message is readable and does not show a backend code.
- The existing request remains unchanged.
- No second request or task is created.

Primary: Farmer Mobile.

Cross-check: Regression.

### QA-RC-03 — Scheduled AI visit

Verify:

- AI request and linked Task refer to the same Farmer, Animal, date, and Technician.
- Visit appears in Technician Schedule and Work Queue.
- The visit cannot be completed for the wrong Animal.
- Completion creates one insemination record and closes the operational task.

Primary: Technician Mobile and Technician Web.

### QA-RC-04 — Day 10 monitoring

Verify:

- Pregnancy diagnosis is unavailable.
- UI explains the eligibility date or remaining wait.
- Monitoring guidance does not claim pregnancy.
- The future diagnosis task is not incorrectly shown as overdue.

Primary: Farmer Mobile.

Cross-check: Technician Mobile and Technician Web.

### QA-RC-05 — Day 21 return-to-heat milestone

Verify:

- Farmer observation action is available.
- Farmer can report return to heat, uncertain, or likely-pregnant observations.
- Observation remains distinct from an official diagnosis.
- Technician clients show the report and evidence.

Primary: Farmer Mobile.

Cross-check: Technician Mobile and Technician Web.

### QA-RC-06 — Likely Pregnant before Day 60

Verify:

- Farmer observation is visible with signs and notes.
- Technician verification is requested.
- Official diagnosis remains locked before Day 60.
- The UI distinguishes Farmer observation from Technician review.

Primary: Technician Mobile and Technician Web.

Cross-check: Farmer Mobile.

### QA-RC-07 — Pregnancy diagnosis due

Verify:

- Correct AI attempt is linked.
- Technician can record a supported diagnostic method and result.
- Pregnant creates or updates one official Pregnancy record.
- Not Pregnant closes the failed cycle correctly.
- Follow-up Required creates/reschedules the appropriate follow-up without duplicates.
- The original task does not remain active after a terminal diagnosis.

Primary: Technician Mobile and Technician Web.

### QA-RC-08 — Confirmed pregnancy

Verify:

- Official diagnosis, AI attempt, and Pregnancy record agree.
- Expected-calving information is visible.
- A new AI request is blocked.
- Farmer and Technician presentation clearly states confirmed pregnancy.

Primary: Farmer Mobile.

Cross-check: Technician Mobile, Technician Web, Admin.

### QA-RC-09 — Calving due today

Verify:

- Calving follow-up is classified as Due Today.
- It is not simultaneously Upcoming or Overdue.
- Correct mother and Pregnancy are linked.
- Calving action opens the correct workflow.

Primary: Technician Mobile and Technician Web.

### QA-RC-10 — Calving overdue

Verify:

- Task is visibly overdue with an actionable calving workflow.
- Recording twins or a mixed outcome creates the correct living offspring count.
- Stillborn outcomes remain embedded records, not living Animal profiles.
- Retry does not create duplicate calving or offspring.

Primary: Technician Mobile and Technician Web.

### QA-RC-11 — Postpartum live birth

Verify:

- Living offspring is visible and linked to the mother.
- Mother parity and reproductive state are correct.
- Pregnancy and insemination cycles are closed.
- AI remains unavailable during postpartum recovery.

Primary: Farmer Mobile.

Cross-check: Technician clients and Admin.

### QA-RC-12 — Stillbirth

Verify:

- Calving history truthfully reports stillbirth.
- No living offspring Animal profile exists.
- Mother lifecycle is reconciled once.
- No generic “successful calving” language is displayed.

Primary: Farmer Mobile.

Cross-check: Technician clients and Admin.

### QA-RC-13 — Abortion

Verify:

- Pregnancy loss is not labeled as calving success.
- No offspring profile is created.
- Parity remains unchanged.
- Recovery state and history remain visible.

Primary: Farmer Mobile.

Cross-check: Technician clients and Admin.

### QA-RC-14 — Mixed outcome

Verify:

- One living offspring profile exists.
- One stillborn outcome is recorded within calving history.
- Counts, mother linkage, and outcome text agree across platforms.

Primary: Farmer Mobile.

Cross-check: Technician clients and Admin.

### QA-RC-15 — Verified return to heat

Verify:

- Previous attempt is visibly unsuccessful and verified.
- Re-insemination is available.
- New first-attempt workflow is not offered.
- Active pregnancy remains absent.

Primary: Technician Mobile and Technician Web.

### QA-RC-16 — Attempt 2 linkage

Verify:

- Attempt number is 2.
- Attempt 2 links to Attempt 1.
- Attempt 1 remains a verified failed attempt.
- Cancelled/rejected requests did not consume an attempt number.
- Duplicate active request prevention remains enforced.

Primary: Technician Mobile and Technician Web.

Cross-check: Farmer Mobile records and Admin.

## Evidence requirements

For every scenario capture:

- Seed scenario and generated Animal tag
- Tester and platform
- Starting state screenshot
- Action screenshot or recording
- Result screenshot
- Relevant request/task/record IDs
- API error response for failures
- Final `PASS`, `FAIL`, or `BLOCKED`

Seed prefixes and internal IDs are evidence only. Report a defect if they are exposed as normal user-facing labels.
