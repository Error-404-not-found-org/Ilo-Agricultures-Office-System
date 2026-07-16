# AI Re-insemination and Health Workflow Manual Test Plan

Date: 2026-07-14

## Product Rules Under Test

### Artificial insemination

- A submitted, approved, scheduled, or in-progress AI request blocks another AI request for the same animal.
- Cancelled and rejected requests do not count as performed attempts.
- An attempt becomes official only after a technician completes the AI service and an insemination date exists.
- A farmer may report either possible pregnancy or return to heat.
- Possible pregnancy is an observation, not pregnancy confirmation. Only a technician pregnancy diagnosis confirms pregnancy.
- Re-insemination is allowed only after the latest performed attempt has a verified failed outcome.
- A re-insemination request links to the previous attempt, remains in the public request board, and is not automatically assigned to the previous technician.
- The previous technician is shown as context; any eligible technician may claim the new request.
- Re-insemination reuses the AI request form in a locked re-insemination mode. It is not a separate unrelated form.

### Health assistance

- One animal may have only one active case of the same health request type.
- Different active case types may coexist when they represent different problems.
- Active includes pending, triaged, assigned, approved, scheduled, and both in-progress compatibility spellings.
- Resolved, rejected, cancelled, or deleted cases no longer block a new case.
- A resolved walk-in service creates the health request and linked medical record in one transaction.

## Test Data

Prepare:

1. One farmer account and one technician account.
2. One eligible female animal with no active AI request.
3. One animal suitable for health-request testing.
4. A second technician account for claim-concurrency and ownership checks.

Use a development database backup. Do not run migration `--apply` against production during this test.

## AI Scenarios

### AI-01 — First attempt

1. Farmer opens the AI request form.
2. Select the eligible animal and submit.
3. Open the technician request board.

Expected:

- Submission closes normally and appears once.
- It is labeled Artificial Insemination, Attempt 1.
- A second immediate submission is blocked with an active-request message.

### AI-02 — Cancelled request does not consume an attempt

1. Cancel or reject the pending request from AI-01.
2. Submit a new request for the same animal.

Expected:

- New request is allowed if the animal remains eligible.
- It is still Attempt 1 because no AI procedure was performed.

### AI-03 — Complete the first procedure

1. Technician claims, schedules, starts, and completes Attempt 1.
2. Inspect the farmer record and animal history.

Expected:

- Completion records the performing technician and insemination date.
- Animal becomes Inseminated.
- Pregnancy is not yet marked confirmed.
- A pregnancy-diagnosis follow-up task exists once.

### AI-04 — Farmer reports possible pregnancy

1. After the observation prompt becomes eligible, choose Possible pregnancy.
2. Reopen the request and animal record.

Expected:

- UI explains that technician confirmation is still required.
- AI outcome is reported/pending verification, not Pregnant.
- No Pregnancy record is created by the farmer action.
- Re-insemination remains unavailable.

### AI-05 — Technician confirms pregnancy

1. Technician opens the pregnancy-check task.
2. Record a Pregnant diagnosis.

Expected:

- Pregnancy record is created and linked to Attempt 1.
- AI outcome becomes verified Pregnant.
- Animal becomes Pregnant.
- Re-insemination is blocked.

### AI-06 — Return-to-heat failure and re-insemination

Use a fresh animal or reset development test data.

1. Complete Attempt 1.
2. Farmer reports Returned to heat, or technician verifies return to heat.
3. From the failed request, choose Request re-insemination.

Expected:

- Re-insemination form opens with the animal locked.
- Previous attempt date, outcome, confirmation source, and planned Attempt 2 are shown.
- Submission creates Attempt 2 linked to Attempt 1.
- Technician mobile and web show Re-insemination · Attempt 2 and previous technician context.
- Request is visible on the request board and is not silently assigned.

### AI-07 — Negative pregnancy diagnosis

1. Complete Attempt 1 on a fresh animal.
2. Technician records an Empty/negative pregnancy diagnosis.
3. Submit re-insemination.

Expected:

- Failure is technician-verified.
- Attempt 2 is allowed and links to Attempt 1.
- Both dates and outcomes remain visible in history.

### AI-08 — Invalid re-insemination paths

Try each case:

1. Re-inseminate while Attempt 1 is pending or scheduled.
2. Re-inseminate after completion but before a verified failure.
3. Re-inseminate from an older attempt when a newer performed attempt exists.
4. Alter the previous-attempt ID to another farmer's request.

Expected:

- Each action is rejected with a specific conflict or authorization message.
- No new request is created.
- Existing records remain unchanged.

## Health Scenarios

### HLTH-01 — Same-type duplicate protection

1. Farmer submits a Disease case.
2. Try another Disease case for the same animal at each lifecycle stage: pending, triaged, assigned, approved, scheduled, and in progress.

Expected:

- Each duplicate is blocked.
- Mobile identifies the existing active case instead of spinning or creating a duplicate.

### HLTH-02 — Different case types

1. Keep the Disease case active.
2. Submit a genuinely separate Injury case for the same animal.

Expected:

- Injury case is allowed.
- Both cases remain independently traceable.

### HLTH-03 — Terminal case releases the guard

1. Resolve or cancel the active Disease case.
2. Submit a new Disease case.

Expected:

- New case is accepted.
- The old case remains in history and is not overwritten.

### HLTH-04 — Resolved walk-in transaction

1. Technician records a resolved walk-in health service.
2. Open the animal medical history and request detail.

Expected:

- One resolved HealthRequest exists.
- One MedicalRecord exists and references that HealthRequest.
- Diagnosis, treatment, technician, date, and withdrawal data match.
- A forced validation failure creates neither record, not a half-completed pair.

### HLTH-05 — Concurrent submission

1. Submit the same health form twice rapidly from two sessions/devices.

Expected:

- One succeeds and one receives conflict status 409.
- Only one active case exists in the database.

## Migration Check

Run dry-run commands first:

```powershell
cd backend
npm run migrate:ai-active-request-keys
npm run migrate:health-active-case-keys
```

Expected:

- Safe records and duplicate groups are reported.
- No data changes during dry run.
- Resolve every reported duplicate manually before using `--apply`.

## Sign-off Evidence

For every scenario record:

- tester and date;
- device/build and backend version;
- pass/fail;
- request and animal IDs;
- screenshot of the relevant UI;
- database evidence for attempt linkage or medical-record linkage;
- defect number for failures.
