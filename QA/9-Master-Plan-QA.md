# MASTER PLAN QA

## Shared Reporting Format

For every failure, record:
- Test ID
- Web or Mobile
- User role
- Animal tag and request/task ID
- Steps performed
- Expected result
- Actual result
- Screenshot or screen recording
- Browser console or Mobile log
- Failed API request and response
- Severity: Blocker, High, Medium, Low

---

## Tester 1 — Accounts and Registration

### AUTH-01: Role authentication
Test on Web and Mobile:
- Farmer signs in and reaches Farmer pages.
- Technician signs in and reaches Technician pages.
- Admin signs in and reaches Admin pages.
- Users cannot access another role’s protected routes.
- Suspended users cannot continue protected operations.
- Sign-out clears the active session.

### REG-01: Farmer registration
From Technician Web:
- Register a new farmer.
- Verify required-field validation.
- Confirm the farmer appears in the Farmers table.
- Open the farmer through the clickable name.
- Verify contact information and profile image fallback.
- Confirm the farmer becomes visible on Technician Mobile.

### REG-02: Animal registration
- Add an animal for the new farmer.
- Verify duplicate ear-tag prevention.
- Verify required animal fields.
- Confirm the animal appears in Web and Mobile.
- Click its name and open the correct Livestock Profile.
- Verify missing images use a round animal/user fallback.
- Confirm ownership, age, gender, breed, and status are mapped correctly.

---

## Tester 2 — Service Request Dispatch

### REQ-01: Health request submission
From Farmer Mobile:
- Submit a Health request.
- Include symptoms, urgency, preferred visit date/time, notes, and photo.
- Confirm the farmer sees it as submitted.
- Confirm Technician Web shows it under Available requests.
- Verify the details modal displays all submitted information.
- Verify the exact farmer contact information remains hidden until claimed.

### REQ-02: Health request claiming
From Technician Web:
- Claim the Health request.
- Confirm another technician can no longer claim it.
- Confirm it appears under My Requests.
- Confirm it also appears in Work Queue if it is now operationally assigned.
- Verify the Work Queue displays Health Assistance, animal, farmer, urgency, and schedule correctly.

### REQ-03: Health scheduling
- Schedule the claimed request.
- Confirm date/time appears in Service Requests, Work Queue, and Schedule.
- Attempt to schedule in the past.
- Attempt to schedule over another visit.
- Attempt to begin the service too early.
- Confirm warnings include the actual scheduled date and time.
- Confirm scheduling updates appear on Farmer Mobile.

### REQ-04: Health completion
- Start the scheduled visit at the permitted time.
- Enter diagnosis, treatment, advice, notes, medicine, dosage, follow-up date, and withdrawal period.
- Submit once, then test accidental double submission.
- Confirm the request becomes resolved.
- Confirm its Work Queue task becomes completed.
- Confirm a Medical Record is created exactly once.
- Confirm the Farmer sees the completed health record.
- Confirm withdrawal warnings appear when applicable.

---

## Tester 3 — Artificial Insemination Workflow

### AI-01: Farmer AI request
- Select an eligible female animal.
- Submit an AI request from Farmer Mobile.
- Confirm the request appears in Technician Service Requests.
- Try submitting a second active AI request for the same animal.
- Confirm duplicate prevention gives a readable message.

### AI-02: Claim and schedule
- Claim the AI request.
- Confirm concurrent claiming is prevented.
- Schedule the visit.
- Confirm it appears correctly in My Requests, Schedule, and Work Queue.
- Verify animal, farmer, previous attempt, preferred date, and location.

### AI-03: Complete insemination
- Open the assigned task from the Work Queue.
- Verify the correct farmer and animal are locked into the form.
- Enter insemination date, sire, semen source, technician notes, and procedure information.
- Complete the procedure.
- Confirm the service request and task close correctly.
- Confirm exactly one insemination record exists.
- Confirm the Farmer Mobile record shows service completion without claiming pregnancy.

### AI-04: Retry safety
- Simulate a slow request or double-click submission.
- Confirm only one insemination is created.
- Verify retry or timeout reconciliation does not duplicate the record.

---

## Tester 4 — Pregnancy Lifecycle

> Use controlled development lifecycle data with dates that satisfy the pregnancy policy.

### PREG-01: Early diagnosis prevention
- Open an AI attempt that is not yet eligible for official diagnosis.
- Attempt to record pregnancy.
- Confirm the action is locked.
- Confirm the UI explains the eligible date.

### PREG-02: Farmer observation
- Farmer reports return-to-heat, likely pregnant, or uncertain observations.
- Include observation notes and photos.
- Confirm the system labels it “Farmer observation,” not an official diagnosis.
- Confirm Technician Web displays the observation evidence correctly.

### PREG-03: Official diagnosis
- Open an eligible pregnancy-diagnosis task.
- Verify the correct AI attempt is linked.
- Record diagnostic method, date, result, and note.
- Test Pregnant, Not Pregnant, and Follow-up Required outcomes.
- Confirm the task is completed or rescheduled appropriately.
- Confirm Web and Mobile show the official diagnosis distinctly from the farmer observation.

### PREG-04: Duplicate-diagnosis prevention
- Attempt to diagnose the same insemination twice.
- Confirm the second attempt is blocked.
- Confirm the old task does not remain active or overdue after a diagnosis already exists.
- Confirm the UI explains that the official diagnosis was already recorded.

### PREG-05: Continuation recheck
- Use a pregnancy requiring continuation.
- Complete the continuation recheck.
- Verify it updates the existing Pregnancy record rather than creating a duplicate.
- Verify task status and follow-up dates synchronize across Web and Mobile.

---

## Tester 5 — Re-insemination and Calving

### REAI-01: Re-insemination eligibility
- Confirm a new attempt is blocked while pregnancy is active.
- Confirm it is blocked when the previous outcome is still unknown.
- Record a verified unsuccessful outcome.
- Confirm re-insemination becomes available.
- Verify Attempt 2 links to Attempt 1.
- Confirm attempt numbers are correct and cancelled requests do not consume a number.

### CALV-01: Calving readiness
- Use a confirmed pregnant animal with a valid expected-calving state.
- Confirm the Calving task appears in the Work Queue at the correct time.
- Confirm the UI distinguishes upcoming from overdue.

### CALV-02: Record calving
- Test:
  - Single live birth
  - Twin live birth
  - Stillbirth
  - Mixed twin outcome
  - Difficult birth
  - Cesarean birth
- Verify:
  - The calving record is created exactly once.
  - Offspring records are created only for applicable outcomes.
  - Mother and offspring are linked.
  - Pregnancy and insemination cycles close.
  - Mother’s reproductive status and parity update.
  - Expected-calving information clears.
  - Farmer and Technician records display the same outcome.

### CALV-03: Calving retry safety
- Double-submit or retry after a simulated timeout.
- Confirm no duplicate calving or offspring records are created.

### POST-01: Postpartum rules
- Confirm AI is unavailable during postpartum recovery.
- Confirm the UI explains the recovery period.
- Confirm eligibility returns only after the policy allows it.

---

## Tester 6 — Work Queue and Schedule

### WQ-01: Task inclusion
- Verify the Work Queue includes assigned active:
  - AI tasks
  - Health Assistance
  - Pregnancy Diagnosis
  - Continuation rechecks
  - Diagnostic follow-ups
  - Calving Assistance
  - General visits

### WQ-02: Classification
- Verify:
  - Due Today uses the local Philippine calendar date.
  - Upcoming excludes Due Today.
  - Paused appears only under On Hold.
  - Completed and cancelled do not appear in active All Tasks.
  - Completed count represents the current week.
  - Overdue tasks have an unfinished operational action.
  - Tasks with already-completed official records do not remain overdue.

### WQ-03: Navigation and actions
- Open every task type.
- Verify it opens the correct workflow and record.
- Confirm browser Back returns to the previous filters and page.
- Confirm actions cannot be performed on another technician’s task.
- Confirm status and action columns do not overlap on narrow screens.
- Test the kebab action menu using mouse and keyboard.

### SCH-01: Schedule consistency
- Compare Work Queue, Service Requests, and Schedule.
- Confirm the same visit has the same date, time, farmer, animal, and status.
- Reschedule and confirm all three views update.
- Cancel a visit and confirm it disappears from active operational lists.

---

## Tester 7 — Admin, Synchronization, and Regression

### ADMIN-01: Monitoring
- Confirm new farmers, animals, requests, tasks, medical records, pregnancy records, and calvings appear in Admin.
- Verify Admin does not see fabricated fallback data.
- Confirm Audit Logs record important changes.

### SYNC-01: Cross-platform consistency
- For every completed workflow:
  - Create or update on Web.
  - Confirm Mobile reflects it after refresh.
  - Create or update on Mobile.
  - Confirm Web reflects it after query refresh.
- Verify notifications do not create duplicate records.
- Verify stale pages refresh after mutations.

### SECURITY-01: Ownership and permissions
- Farmer cannot read or modify another farmer’s animal.
- Technician cannot complete another technician’s assigned request.
- Farmer cannot record an official pregnancy diagnosis.
- Non-admin cannot use correction endpoints.
- Cancelled or resolved requests cannot be reopened through old actions.

### UI-01: Themes and responsiveness
- Test Web in light and dark mode at:
  - 1366×768 desktop
  - Narrow laptop
  - Tablet width
  - Mobile width
- Verify:
  - No horizontal dashboard overflow.
  - Tables scroll internally when necessary.
  - Modals fit within the viewport.
  - Text and placeholders remain readable.
  - Focus indicators are visible.
  - Buttons and menus work using keyboard navigation.

---

## Final Release Scenario

- Assign one teammate to perform the complete uninterrupted chain:
  - Register farmer
  - Register animal
  - Submit AI request
  - Claim
  - Schedule
  - Complete AI
  - Farmer observation
  - Official pregnancy diagnosis
  - Continuation recheck if required
  - Confirm pregnancy
  - Record calving
  - Verify offspring
  - Verify postpartum restriction
  - Verify all records on Web, Mobile, and Admin
- No merge should happen until this final chain completes without manual database corrections.

---

## ✅ SUCCESS CONFIRMATION

**BreedSmart Complete Workflow Testing: PASSED**

The following have been successfully verified:
- Farmer and livestock registration
- Health and AI request submission
- Technician claiming and scheduling
- Work Queue and Schedule synchronization
- Health-service completion
- Artificial insemination completion
- Farmer observations and official pregnancy diagnosis
- Continuation rechecks and re-insemination rules
- Calving, offspring creation, and postpartum restrictions
- Web, Mobile, Backend, and Admin record consistency
- Duplicate-submission protection
- Authentication, permissions, responsive UI, and accessibility
- No blocking or high-severity defects remain

**Release decision:** Approved for merge into main and controlled production deployment.

*Use this confirmation only after your team completes the checklist and provides evidence for every critical workflow.*

---

## Shared Reporting Format

For every failure, record:
- Test ID
- Web or Mobile
- User role
- Animal tag and request/task ID
- Steps performed
- Expected result
- Actual result
- Screenshot or screen recording
- Browser console or Mobile log
- Failed API request and response
- Severity: Blocker, High, Medium, Low

> **Note:** For every report you have, write it in the BreedSmart Bug Report.
