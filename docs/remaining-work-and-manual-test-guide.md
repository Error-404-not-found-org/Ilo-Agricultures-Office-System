# Remaining Work and Manual Test Guide

Last updated: 2026-07-14

## Purpose

This guide converts the remaining master-plan work into a safe execution order. Each step identifies:

- what Codex or another developer should implement;
- what the project owner should test manually;
- the expected result;
- the evidence to collect when something fails;
- the condition required before continuing.

Current estimated project completion: **66%**.

## 2026-07-14 Priority Reset

The latest code audit found that backend record integrity and Records-page semantics must be completed before further broad visual redesign. The following corrections are already implemented and require manual verification:

- Animal Edit changes identity/profile information only. It must not create or rewrite AI, pregnancy, or calving history.
- Farmer and technician calving use the same transactional calving service.
- Every breeding-observation verification outcome uses one canonical transaction.
- Technician mobile Records shows completed official events, not pending requests or completed work-list tasks.
- The technician bottom navigation exposes Records directly.
- Technician mobile Records does not offer direct record deletion.
- Web Reports excludes unfinished AI and health requests.
- Missing web locations display `Location not provided` instead of a fabricated barangay.
- A user cannot mark another user's notification as read by supplying its ID.

Immediate remaining developer work:

1. Complete the manual matrix in this guide before increasing the completion percentage.
2. Fix any failures found during authenticated web, Expo, and real-device acceptance testing.

Canonical record-feed implementation status:

- The canonical endpoint and all three primary consumers are implemented through `GET /api/animals/records`.
- Automated tests cover farmer scoping, completed-AI filtering, General Note normalization, ordering, and invalid date ranges.
- Manual acceptance remains required before the master-plan percentage changes.

Manual canonical-feed checks:

1. Create or identify one completed AI record, pregnancy diagnosis, calving, health Medical Record, and General Note for the same farmer.
2. Sign in as that farmer and open Records. Confirm all five official entries appear in service-date order.
3. Confirm pending AI and open health requests appear under Requests, not Records.
4. Sign in as another farmer. Confirm none of the first farmer's entries appear.
5. Sign in as a technician. Confirm the same entries appear in technician Records with farmer and animal identity.
6. Select the General Notes filter. Confirm only General Notes remain.
7. Open web Reports. Confirm its entries match technician mobile Records for the same date range.
8. Search by farmer name, ear tag, animal ID, breed, technician, sire code, diagnosis, and note text.
9. Test From/To dates, including an invalid reversed range. Confirm invalid ranges are rejected clearly.
10. Test a farmer with more than 25 records and verify page metadata and ordering remain correct.
11. On farmer mobile, technician mobile, and web Reports, confirm the first 25 records load and Load More appends the next page without duplicates.
12. Continue until the final page. Confirm the button is replaced by `All N records loaded` and N matches the API total.
13. Apply a filter with no match on the first page but a match on a later page. Confirm `Search the next page` remains available.
14. Pull to refresh on both mobile Records screens. Confirm the list returns to the newest page without stale duplicates.

Manual checks for this implementation pass:

1. As a technician, edit an animal's tag, color, or breed. Confirm the profile updates and its existing AI, pregnancy, and calving dates remain unchanged.
2. Open technician Records. Confirm pending/approved/scheduled service requests do not appear.
3. Complete an AI service and resolve a health case. Confirm both appear in Records after refresh.
4. Confirm Records is visible in the technician bottom navigation and opens the Records screen.
5. Confirm no delete button appears in the technician record-detail sheet.
6. Record calving once as a farmer. Confirm offspring, calving history, mother status, last-calving date, and parity update together.
7. Attempt to record the same pregnancy's calving again. Confirm the API rejects it without creating extra offspring.
8. On web Reports, confirm pending AI and open health requests are absent, while completed/resolved entries remain.

Manual breeding verification and correction checks:

1. Verify one completed AI attempt as Pregnant. Confirm one Pregnancy record is created, the animal becomes Pregnant, and the linked PD task becomes Completed.
2. Verify another completed attempt as Not Pregnant. Confirm an `Empty` diagnosis is visible in Records, the AI attempt becomes a verified failed attempt, and the animal returns to Normal.
3. Verify Return to Heat. Confirm no Pregnancy record is created, the attempt becomes `Failed (Re-heat)`, and the animal becomes In Heat.
4. Select Needs Recheck with a future date. Confirm the outcome remains pending and the PD task is scheduled for that date.
5. Try Needs Recheck without a future date. Confirm the complete transaction is rejected and no partial AI, animal, or task change remains.
6. As a technician, call a pregnancy or calving correction route. Confirm access is denied because corrections are admin-only.
7. As an admin, correct a pregnancy result with a reason shorter than 10 characters. Confirm it is rejected.
8. Correct a pregnancy from Pregnant to Empty when it already has a calving. Confirm `PREGNANCY_HAS_CALVING` is returned and no data changes.
9. Correct a calving date with a valid reason. Confirm the calving record, mother's last-calving date, and linked offspring birth dates agree.
10. Open the admin audit log and confirm the old values, corrected values, reason, actor, and timestamp are retained.

Manual re-insemination consolidation checks:

1. Complete and verify Attempt 1 as failed, then use Request Re-insemination in farmer mobile. Confirm the request is created through `/api/ai-request/:id/re-insemination` as Attempt 2.
2. Confirm Attempt 2 links to Attempt 1 and appears once on technician mobile and web request boards.
3. Try re-insemination from an older attempt when a newer performed attempt exists. Confirm `PREVIOUS_AI_ATTEMPT_NOT_LATEST` is returned.
4. Try before the previous result is verified failed. Confirm `PREVIOUS_AI_FAILURE_NOT_VERIFIED` is returned.
5. Send one compatibility request to `/api/animals/re-inseminate` with the same farmer and animal. Confirm it follows the same validation and response fields as the canonical endpoint.
6. Inspect that compatibility response and confirm the `Deprecation`, `Sunset`, and successor `Link` headers are present.
7. Confirm technician status changes through `/api/technician/inseminations/:id/status` and `/api/ai-request/:id/status` reject and allow the same transitions.

## Rules Before Testing

1. Use the development database, never production.
2. Do not run `npm run migrate:status-vocabulary` until a database backup is verified.
3. Use unique test values, for example `Offline Farmer 20260712-01` and `TEST-COW-001`.
4. Do not repeat Submit when a form appears slow. Record the loading time first.
5. Keep the backend terminal and Expo terminal visible during tests.
6. Take a screenshot before dismissing an unexpected error.
7. Test one chain at a time so failed queue items are easy to identify.

## Evidence Template

For every failed scenario, record:

```text
Test name:
Role and platform:
Online or offline:
Exact step that failed:
Expected result:
Actual result:
Visible error text:
Queue item status:
Expo terminal output:
Backend terminal output:
Screenshot filename:
Test farmer name:
Test animal ear tag:
```

## Step 1: Establish a Safe Database Baseline

Developer work:

- Document the active development database environment.
- Prepare a verified backup procedure.
- Confirm the migration script targets the intended environment.

Your manual work:

1. Confirm you are using the development database.
2. Create a backup using your MongoDB hosting dashboard or approved backup method.
3. Record the backup name, date, database name, and restore location.
4. Verify the backup appears as available.
5. Only after verification, run from `backend`:

```powershell
npm run migrate:status-vocabulary
```

6. Save the matched and updated counts printed by the migration.
7. Open several animals and health requests that existed before migration.
8. Confirm `Open` animals appear as `Normal` / `Open & Available` in the UI.
9. Confirm legacy `in_progress` health requests appear as `in-progress`.

Stop condition:

- Do not continue if the backup cannot be identified or restored.
- Do not run the migration against production.

## Step 2: Test Offline Farmer to Animal Synchronization

Developer status:

- Temporary farmer IDs and ordered farmer-to-animal queue dependencies are implemented.
- A hard seven-second offline fallback is implemented so React Native requests
  cannot keep either registration form loading until connectivity returns.
- Technician Profile > System & Support now includes a Sync Center entry.
- The backend's global idempotency middleware protects delayed requests and
  queue replays from creating duplicate records.

Retest requirement:

- The first APK test failed because farmer and animal submission waited for
  reconnection and the technician Sync Center link was missing.
- Build and install a new APK before retesting; an already installed APK does
  not contain these corrections.

Your manual work in the new APK (or a refreshed Expo development build):

1. Sign in as a technician while online.
2. Open Farmers once so reference data is cached.
3. Turn off Wi-Fi and mobile data.
4. Register a farmer using a unique name and phone number.
5. Confirm the form stops loading immediately when offline is detected, or in
   no more than seven seconds when Android reports stale connectivity.
6. Confirm “Record saved on this device” appears before reconnecting.
7. Choose Register Animal in the follow-up prompt.
8. Register an animal with a unique ear tag.
9. Confirm the animal form also finishes before reconnecting.
10. Open Technician Profile > System & Support > Sync Center.
11. Confirm two items exist in this order:
   - Register Farmer
   - Register Animal
12. Confirm neither item is permanently failed.
13. Close and reopen the app while still offline.
14. Confirm both queue items remain.
15. Restore the network.
16. Wait for automatic synchronization.
17. Confirm both items leave Pending and appear in Recently Synced.
18. Open the web dashboard.
19. Confirm exactly one farmer and one animal exist.
20. Confirm the animal belongs to the correct farmer.

Pass condition:

- The farmer synchronizes before the animal.
- Temporary IDs are not visible after synchronization.
- No duplicate farmer or animal exists.

Send failure evidence if:

- animal sync starts before farmer sync;
- either item remains `syncing`;
- the animal references the wrong farmer;
- duplicate records appear.

## Step 3: Implement and Test Animal to Official Record Chaining

Developer work remaining:

- Add an optional Add Record prompt after an offline animal is saved.
- Pass the temporary animal and farmer IDs into an appropriate official record form.
- Ensure the record queue item depends on the animal queue item.
- Keep Not Now available because registration does not require a service record.

Your manual work after implementation:

1. Repeat Step 2 while offline.
2. After registering the animal, choose Add Record.
3. Add an AI or health record suitable for the test animal.
4. Confirm three ordered items appear:
   - Register Farmer
   - Register Animal
   - Add Official Record
5. Restart Expo Go while offline.
6. Reconnect.
7. Confirm synchronization completes in the same order.
8. Confirm the official record appears once in the animal’s web history.

Pass condition:

- The official record uses the final server animal ID.
- The record appears under the correct farmer and animal.
- No duplicate record is created.

## Step 4: Authentication Recovery Test

Developer work remaining:

- Trigger queue processing after Clerk authentication is restored.
- Keep 401 failures pending without consuming the retry budget.
- Show “Sign in again to continue syncing” in Sync Center.

Your manual work after implementation:

1. Queue one offline change.
2. Expire the session by signing out, revoking the session, or using the approved test method.
3. Restore the network.
4. Confirm the item remains Pending and is not discarded.
5. Confirm retry count does not rapidly reach five.
6. Sign in again.
7. Confirm synchronization resumes automatically or through one explicit Retry.
8. Confirm the item synchronizes once.

Pass condition:

- Authentication failure never permanently loses queued data.

## Step 5: Missing Attachment Recovery

Developer work remaining:

- Classify missing cached images as a permanent attachment problem.
- Show which queued item is affected.
- Explain that the photo must be selected again or the item discarded.
- Provide a safe replacement/retry workflow where practical.

Your manual work after implementation:

1. Queue a health or calving record with a photo while offline.
2. Use a controlled development method to make the cached attachment unavailable.
3. Reconnect.
4. Confirm only the affected item fails.
5. Confirm its error explains that the attachment is missing.
6. Confirm unrelated earlier/safe items are not deleted.
7. Replace the image or discard the affected item deliberately.

Pass condition:

- The app never loops indefinitely or silently drops the record.

## Step 6: Response-Loss and Duplicate Protection

Developer work remaining:

- Add focused tests around idempotency keys and response-loss replay.
- Confirm all creation endpoints used offline support idempotency middleware.

Your manual work:

1. Submit a test record online using an unstable connection.
2. Disconnect immediately after Submit to simulate a lost response.
3. Reconnect and allow the queued retry.
4. Search the web dashboard for the test record.
5. Confirm exactly one record exists.
6. Repeat for farmer, animal, AI, and health creation.

Pass condition:

- One user action creates one server record even if its first response is lost.

## Step 7: Complete Remaining Web Record Features

Developer work remaining:

- General Note is implemented in the contextual Add Record menu and shared
  backend record vocabulary.
- Service-date, entry-date, and recent-activity filters are implemented.
- AI and health official records now expose source-request deep links on web;
  full manual and route-level regression testing remains.
- Ensure every record detail shows farmer, animal, service date, entry date, status, and technician attribution.

Your manual work after implementation:

1. Find a farmer by name, phone, and barangay.
2. Find an animal by animal ID and ear tag.
3. Open the animal history.
4. Filter by record type.
5. Filter by service date.
6. Filter by entry date.
7. Add a General Note.
8. Complete one AI request through the official workflow.
9. Complete one health request through the official workflow.
10. Confirm each completed request links to exactly one official record.
11. Refresh the browser and repeat navigation using Back and Forward.

Pass condition:

- Search/filter state is preserved.
- Requests are never displayed as completed records before service completion.
- Each completion produces one official record.

## Step 8: Farmer and Technician Cross-Platform Consistency

Observed defects to implement and verify:

- Farmer bottom navigation, quick actions, Profile actions, language choices,
  and Settings tool buttons now support translated wrapping and flexible
  alignment. Continue auditing every translated farmer action in English,
  Filipino, and Hiligaynon. Buttons must keep aligned icons, readable labels,
  minimum touch size, and must not overlap or clip when translated text grows.
- The persistent Moowie analysis banner has been removed from Farmer Records.
- Recent Activity date and status chips have been replaced by compact dropdown
  filters.
- A user-scoped My Support Tickets endpoint and Help Center history view show
  pending, in-progress, and resolved states. Farmers and technicians must be
  able to verify whether a submitted ticket was received and handled.
- Farmer health reporting now sends canonical `emergency`; the backend safely
  maps legacy `critical` submissions to `emergency` before validation and
  persistence. Cross-platform display and analytics still require manual QA.

Developer status:

- Farmer record details now expose service date, BreedSmart entry date,
  historical-entry status, original performer, and late-entry reason when the
  server record contains them.
- New medical and General Note notifications carry an explicit animal link and
  open the farmer's animal workspace instead of guessing a technician route.
- Notification-detail access is now scoped to the signed-in recipient.
- Full manual comparison across web, technician mobile, and farmer mobile
  remains required.

Your manual work:

1. Create or complete a technician record on web.
2. Open the same animal as the farmer on mobile.
3. Confirm record type, service date, entry date, technician, and status agree.
4. Repeat with a record created on technician mobile.
5. Confirm the web dashboard displays the same information.
6. Confirm the farmer cannot edit protected technician-owned history.
7. Test notification links and ensure they open the correct animal or record.

Pass condition:

- Web, technician mobile, and farmer mobile converge to the same server truth.

## Step 9: API, Security, and Production Hardening

Developer work remaining:

- Standardize common success, validation, conflict, and pagination envelopes.
- Enforce pagination on remaining large lists.
- Audit animal and record ownership checks on every detail endpoint.
- Add audit logs for historical record creation and corrections.
- Verify rate limits and upload limits.
- Remove or protect debug/test routes.
- Test realtime and push deduplication.

Your manual work after implementation:

1. Sign in as Farmer A and attempt to open Farmer B’s animal/record URL.
2. Confirm access is denied.
3. Sign in as technician and verify authorized access.
4. Try an invalid lifecycle transition and confirm a readable conflict message.
5. Load large farmer, animal, request, and record lists.
6. Confirm pagination works and the UI remains responsive.
7. Perform one historical entry and confirm an audit event exists.

Pass condition:

- No cross-farmer data exposure exists.
- Common errors are readable on web and mobile.

## Step 10: Accessibility and Responsive QA

Developer status:

- Add Record and Activity Detail web dialogs now support Escape, initial
  focus, keyboard focus containment, accessible dialog labels, and constrained
  scrolling on short screens.
- The animal-history filter row now collapses controls to full width on narrow
  screens.
- Systematic authenticated viewport and device QA remains required.
- Technician Animal Registry and Animal Details no longer emit query-error
  toasts during backend outages or retries. They render one inline error state
  with an explicit Retry action; direct user-action failures still use toasts.
- Emergency urgency is now included in technician web metrics, styling, and
  analytics, while technician mobile normalizes high/emergency cases into the
  Urgent queue.

### Web manual checks

1. Test at approximately 1366×768, 1024×768, and 768×1024.
2. Navigate the full farmer/animal/record workflow using keyboard only.
3. Confirm focus is always visible.
4. Confirm dialogs trap focus and Escape closes them safely.
5. Confirm labels remain associated with inputs.
6. Test light and dark mode.
7. Test long names, missing images, missing phone numbers, and large histories.

### Mobile manual checks

1. Test at least one small and one normal Android screen.
2. Open the keyboard on every important form.
3. Confirm fields and Submit remain reachable.
4. Confirm touch targets are easy to press.
5. Confirm the offline banner never covers action feedback or buttons.
6. Test light and dark mode where supported.
7. While signed in as a technician, make the backend unavailable and reload
   Animals, Animal Details, and Records.
8. Confirm one backend outage produces at most one deduplicated error notice
   per screen, not one toast for every failed query or automatic retry.
9. Confirm background refetch failures use an inline stale/error state and do
   not repeatedly interrupt the technician with toasts.
10. Restore the backend and confirm recovery does not replay old error toasts.
11. Switch among English, Filipino, and Hiligaynon and confirm translated
    button labels remain aligned, readable, and tappable.
12. Confirm Farmer Records opens directly to records without a persistent AI
    banner and provides dropdowns for recent-period and status filtering.
13. Submit a support ticket, open My Tickets, and verify every status change is
    visible to the submitting user.
14. Submit every health urgency option and confirm the API accepts and displays
    the same canonical value on farmer, technician, and web views.

Pass condition:

- Core workflows remain usable without clipped controls or hidden errors.
- Repeated query failures and retries do not create toast storms.

## Step 11: Full Release Matrix

Run every critical workflow using:

- technician web;
- technician mobile online;
- technician mobile offline then reconnecting;
- farmer mobile;
- admin where approval or correction is required.

Run every record type:

- farmer registration;
- animal registration;
- AI request and walk-in AI;
- pregnancy diagnosis;
- calving and offspring;
- health request and manual health record;
- past record;
- general note.

Run every edge case:

- double Submit;
- response lost after server success;
- expired authentication;
- validation failure during sync;
- temporary parent ID;
- app restart;
- two technicians claiming the same work;
- browser refresh during submission;
- farmer viewing the completed record.

Release gate:

- Backend, web, and mobile automated checks pass.
- Every critical manual scenario has recorded evidence.
- No critical/high defect remains.
- Backup and rollback instructions are verified.
- Known issues are documented.

## Recommended Working Order

### Temporary Presentation Readiness Sprint

Until the upcoming progress review, presentation readiness takes priority over
non-blocking feature completion. Preserve the full roadmap below, and do not
count deferred work as complete.

1. Polish farmer mobile: Home, Animals, Animal Details, Records, AI Request,
   Health Concern, Notifications, Help Center, Profile, and Settings.
2. Polish technician mobile: Dashboard, Farmers, Farmer Profile, Animals,
   Animal History, Requests, Schedule, Add Record forms, and Profile.
3. Polish technician web: Dashboard, Farmers Directory, Farmer Profile, Animal
   Profile and History, Requests, Schedule, and record-entry dialogs.
4. Polish admin web: Dashboard, Users, Animals, Records, Request Monitoring,
   Support Tickets, and the navigation/layout shared by those pages.
5. Run responsive, language, loading, empty, error, and keyboard checks on all
   presentation pages.
6. Prepare clean representative demo data and rehearse the end-to-end story.
7. Fix presentation blockers only, then resume the full roadmap after review.

Presentation acceptance:

- Admin and technician pages share one header, control, table/list, dialog,
  status badge, spacing, and empty/error-state language.
- The admin dashboard provides a clear municipal overview and direct access to
  users, animals, records, requests, and support tickets.
- No presentation path contains clipped labels, repeated error toasts, stuck
  loading, wrong-role navigation, broken back actions, or unexplained empty
  screens.
- Demo-critical writes still follow canonical backend workflows and cannot
  create duplicates or cross-role data exposure.

The offline defect found in Step 2 is deferred, not passed or closed. The
working order is intentionally changed to prioritize day-to-day usability and
cross-platform workflow clarity:

1. Complete and test Step 7: web farmer, animal, history, and record usability.
2. Run Step 8: farmer and technician consistency across web and mobile.
3. Run Step 10: responsive, keyboard, modal, navigation, and accessibility QA.
4. Complete the online portions of the canonical AI, health, pregnancy,
   calving, notification, and historical-entry workflows.
5. Return to Step 2 and resolve the known offline farmer submission blocker.
6. Implement and test Steps 3-6 for dependent offline records, authentication
   recovery, attachments, and response-loss protection.
7. Implement and test Step 9: API, security, pagination, and production hardening.
8. Run Step 11 and prepare the release decision.

## What You Should Do Right Now

Your immediate task is the **Temporary Presentation Readiness Sprint**, with
farmer mobile, technician mobile/web, and core admin web treated as equal demo
targets.

Focus first on whether a technician can quickly find a farmer and specific
animal, understand the animal's complete history, and add a current or past
record with consistent terminology and outcomes across web and mobile.

Do not mark offline synchronization complete. Its current known defect is that
farmer submission may remain loading until connectivity returns. It must be
retested and resolved before release validation.
