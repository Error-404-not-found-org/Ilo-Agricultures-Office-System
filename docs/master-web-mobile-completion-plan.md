# Master Web, Mobile, and Backend Completion Plan

Last updated: 2026-07-15

### 2026-07-15 Technician web Overview and lifecycle workspace pass

- Overview counts and charts now use real backend aggregates for AI, health, pregnancy, and calving instead of placeholder values.
- Web Quick Actions match the six Mobile Technician workflows and use dedicated registration versus service-record entry paths.
- Health Assistance now captures emergency urgency, medicine/dosage, follow-up date, and withdrawal period and shows those details during review.
- Breeding Ledger no longer labels all AI requests as completed services; it distinguishes completed AI from active requests and provides direct AI, pregnancy-check, and calving record actions.
- Re-insemination history shows the populated previous attempt when available and explicitly flags legacy attempt-number records that are missing their backend link.
- Automated build/lint validation passed for this implementation group. Full manual lifecycle execution and legacy attempt-link data cleanup remain required before changing the overall completion percentage.

## 1. Purpose

This is the single master roadmap for completing the farmer and technician experience across the web dashboard, Expo mobile app, backend, offline queue, and synchronization layer.

The primary product goal is:

> A technician can quickly find a farmer, select a specific animal, understand its complete history, add a current or past record, and trust that the record is saved and synchronized. A farmer can see the same official history in a simpler role-appropriate view.

This plan consolidates and supersedes progress estimates scattered across the other planning documents. Those documents remain useful as detailed references.

## 2. Current Overall Estimate

Estimated overall completion: **66%**.

This percentage is a planning estimate, not a count of files or screens. Completion requires implementation, automated verification, manual workflow testing, and release readiness.

| Area | Current estimate | Weight | Weighted contribution |
|---|---:|---:|---:|
| Backend workflow integrity | 82% | 25% | 20.50% |
| Mobile workflows and offline sync | 68% | 25% | 17.00% |
| Web technician workflow | 73% | 25% | 18.25% |
| Cross-platform consistency and UX | 54% | 15% | 8.10% |
| End-to-end testing and release readiness | 25% | 10% | 2.50% |
| **Rounded overall completion** |  | **100%** | **66%** |

Percentages must only increase when the acceptance criteria for a phase pass.

### 2026-07-14 audit correction and implementation pass

The estimate was recalibrated after tracing active routes and UI data sources rather than relying on earlier implementation summaries. The audit found that several active paths still bypassed canonical lifecycle services and that Records screens mixed future requests with completed official events.

Completed in this pass:

- Animal profile editing is now identity-only and rejects AI, pregnancy, and calving fields with `LIFECYCLE_FIELDS_NOT_ALLOWED`.
- Farmer calving now uses the shared transactional `persistCalving` service.
- All technician breeding-observation outcomes now use one transaction service for the pregnancy diagnosis, AI outcome, animal status, and linked pregnancy-check task.
- Insemination deletion is limited to technician/admin roles and now soft-deletes its breeding cascade in one transaction with an audit log.
- Technician mobile Records no longer merges pending AI requests or completed tasks into official animal history. AI entries require a completed status and health entries require a resolved status.
- Direct deletion was removed from the technician mobile Records UI. Corrections remain controlled backend operations.
- Records is now a visible technician mobile bottom-navigation destination.
- Web technician Reports excludes unfinished AI and health requests from live official activity.
- Web farmer and animal directories no longer fabricate `Oton Proper` when a location is missing.
- Marking a single notification read is now scoped to the signed-in recipient.

Still required before increasing the estimate:

- Complete responsive, dark-mode, translated-label, offline-device, notification, and role-based acceptance testing.

### 2026-07-14 canonical official-record feed

Implemented `GET /api/animals/records` as the shared role-scoped official-record feed.

- Farmers are always scoped to their own records, even if another `farmerId` is supplied.
- Technician, veterinarian, and admin roles can search across farmers and optionally filter by farmer or animal.
- The feed contains only completed AI, pregnancy diagnosis, calving, Medical Record, and General Note documents.
- Pending AI and health service requests are deliberately excluded.
- Results use a common category, service date, entry date, title, summary, farmer, animal, technician, and source payload.
- Type, search, farmer, animal, date range, page, and limit filters are supported.
- Technician mobile Records, farmer mobile Records, and technician web Reports now consume this feed.
- Farmer Records no longer uses the limited five-per-type activity endpoint or labels official history with request statuses.
- General Notes have a distinct technician Records filter.

The overall percentage remains 66% until authenticated manual acceptance proves role scoping, record completeness, filtering, pagination behavior, and consistent record details on real web/mobile sessions.

### 2026-07-14 breeding verification and correction integrity

- Pregnant, not-pregnant, return-to-heat, and needs-recheck verification now share one MongoDB transaction.
- A technician-confirmed negative diagnosis creates the official `Empty` pregnancy record and closes the AI attempt; return-to-heat closes the attempt without inventing a pregnancy diagnosis.
- A recheck keeps the AI outcome pending and atomically reschedules or creates the linked pregnancy-check task.
- Pregnancy and calving hard-delete handlers no longer erase official history.
- Admin-only correction endpoints require a written reason, update linked lifecycle data in the same transaction, and create audit logs.
- Pregnancy corrections cannot contradict an existing calving, and calving date corrections update the linked offspring birth dates.
- Backend automated verification now passes 108 tests. The estimate remains 66% until the manual matrix is accepted.

### 2026-07-14 official-record pagination

- Farmer mobile Records, technician mobile Records, and technician web Reports now request 25 official records per page instead of hard-coding the first 100.
- Load More appends records without duplicating existing entries and displays the API's total count.
- Loading and end-of-results states are explicit in light and dark mode.
- When a client-side filter has no match in the currently loaded page, the user can continue searching the next page rather than seeing a false final empty state.
- Pull-to-refresh resets mobile Records to the current first page and updated total.
- Manual testing with more than 25 official records is still required, so the overall estimate remains 66%.

### 2026-07-14 re-insemination route consolidation

- `POST /api/ai-request/:id/re-insemination` remains the only canonical re-insemination creation workflow used by the current mobile app.
- The installed-client URL `POST /api/animals/re-inseminate` is retained temporarily as a compatibility adapter. It resolves the farmer's latest performed attempt and delegates to the canonical controller.
- The compatibility response includes `Deprecation`, `Sunset`, and successor `Link` headers and now uses the same rate limiter as the canonical route.
- The second re-insemination creation implementation was removed from `animals.controllers.js`; it can no longer diverge on eligibility, attempt linking, notifications, timeline, or audit behavior.
- The unused `updateInseminationStatus` controller was deleted. Both current and compatibility technician status routes already use canonical `updateRequestStatus`.
- No mobile or web UI changes were required because the active farmer form already calls the canonical endpoint.
- Manual compatibility and authenticated workflow testing remains required, so the overall estimate remains 66%.

## 3. Product Vocabulary

Use the same user-facing vocabulary on web and mobile:

| Concept | Preferred label | Meaning |
|---|---|---|
| Farmer registration | Register Farmer | Create a farmer/client profile |
| Animal registration | Register Animal | Add an animal owned by a farmer |
| Official service record | Add Record | Record work that already happened |
| Farmer-generated request | Service Request | Ask a technician to perform future work |
| Artificial insemination | AI Service | Official insemination workflow |
| Animal medical event | Health Record | Diagnosis, treatment, medicine, or follow-up |
| Complete animal history | Animal History | Unified chronological records for one animal |
| Unsynchronized local item | Waiting to Sync | Saved locally but not yet accepted by the server |

“Register Farmer” must never be presented as an alternative way to add an animal health or AI record. Registration creates identities; record entry captures events.

## 4. Target Information Architecture

### Technician web navigation

1. Overview
2. Farmers
3. Animals
4. Service Requests
5. Schedule
6. Records
7. Map
8. Reports
9. Profile and Settings

Records may contain focused views for AI, health, pregnancy, and calving, but the sidebar should not expose many overlapping names that force technicians to understand internal data models.

### Technician mobile navigation

1. Home
2. Farmers
3. Tasks or Schedule
4. Records
5. Profile

Offline Sync should be accessible from status indicators and settings, not compete with the technician’s daily primary workflow.

### Farmer mobile navigation

1. Home
2. Animals
3. Requests
4. Records
5. Profile

The farmer sees official records but cannot silently rewrite technician-owned service history.

## 5. Canonical User Journeys

### Journey A: Find a specific animal

1. Search by farmer name, phone, barangay, animal ID, or ear tag.
2. Open the farmer profile or animal result.
3. See owner and animal identity at all times.
4. Open Animal History.
5. Filter history by record type or date.

Success target: a known animal can be reached in three meaningful actions from the main technician workspace.

### Journey B: Add a current service record

1. Begin from the selected animal.
2. Choose Add Record.
3. Choose AI, Health, Pregnancy Check, Calving, or General Note.
4. The farmer and animal fields are prefilled and locked unless the technician explicitly changes context.
5. Validate required clinical or service fields.
6. Submit once.
7. Show Saved or Waiting to Sync.
8. Display the new item in Animal History.

### Journey C: Add a past record

1. Follow the same Add Record flow.
2. Enable “This happened earlier” or select the actual service date.
3. Prevent future dates and impossible lifecycle sequences.
4. Clearly display “Recorded on” separately from “Service date.”
5. Preserve the technician who entered the record and, when known, the technician who performed the service.

### Journey D: Work offline

1. Connectivity indicator changes without covering action feedback.
2. Submit remains responsive.
3. The record is saved to the device queue.
4. Show a finite confirmation: “Record saved on this device.”
5. Close or reset the form normally.
6. Display Waiting to Sync on the temporary record where appropriate.
7. Reconnect and synchronize automatically.
8. Replace temporary IDs with server IDs without duplication.
9. Show success or actionable failure in the Sync Center.

### Journey E: Farmer views technician record

1. Technician record synchronizes successfully.
2. Farmer refreshes or receives realtime/push notification.
3. The same official event appears in the farmer’s animal history.
4. Dates, animal identity, status, and technician attribution agree with the technician view.

## 6. Completed Foundation

The following are treated as implemented but remain subject to end-to-end regression testing:

- Canonical AI status implementation with a compatibility route alias.
- Shared transactional pregnancy diagnosis service.
- Shared transactional calving service.
- Removal of redundant AI and health post-transaction writes.
- Shared backend status vocabulary foundation.
- Compatibility normalization for legacy animal and health statuses.
- Single active mobile offline queue type.
- Reusable offline mutation executor for migrated technician actions.
- Dedicated queued-save toast for reusable offline mutations.
- Web compatibility for Open/Normal animal filtering.
- Backend automated test baseline: 69 passing tests as of this update.
- Web lint, 14 tests, and production build passing.
- Mobile TypeScript check passing; lint has zero errors and 114 existing warnings.

## 7. Remaining Implementation Roadmap

## Phase 0: Establish the Release Baseline

Goal: make the roadmap measurable before further UI work.

Tasks:

- Record the current branch, environment requirements, and known warning baseline.
- Back up the development database.
- Run the status-vocabulary migration in development only.
- Verify migration counts and spot-check affected animal and health records.
- Inventory every active web and mobile route for technician and farmer roles.
- Mark legacy screens as Keep, Redirect, Merge, or Remove Later.
- Create a compact traceability table mapping each UI action to its canonical endpoint.

Acceptance criteria:

- Database backup exists and can be identified.
- No legacy `Open`, `Postpartum`, or `in_progress` records remain in development after migration.
- Every primary UI mutation has one documented endpoint owner.
- Existing automated checks remain green.

Estimated contribution: 3 percentage points.

## Phase 1: Web Navigation and Terminology

Goal: remove sidebar and page-name confusion before redesigning detailed screens.

Tasks:

- Apply the target technician navigation labels.
- Ensure sidebar label, browser title, page heading, breadcrumb, and empty-state language agree.
- Merge or de-emphasize duplicate destinations.
- Add redirects for renamed routes rather than breaking saved links.
- Distinguish Register Farmer, Register Animal, Add Record, and Service Request in copy.
- Ensure active navigation state remains correct on detail pages.
- Test common laptop and tablet widths.

Acceptance criteria:

- A technician can explain the purpose of every sidebar item without developer knowledge.
- No two primary sidebar items appear to perform the same job.
- Renamed links preserve old URLs through redirects or compatibility routes.
- Keyboard focus and active-state styling are visible.

Estimated contribution: 4 percentage points.

## Phase 2: Web Farmer and Animal Discovery

Goal: make record retrieval fast and predictable.

Tasks:

- Create one prominent search entry point on Farmers and Animals.
- Support farmer name, phone, barangay, animal ID, and ear tag.
- Add useful filters: species, sex, reproductive status, barangay, and recent activity.
- Show result context: farmer, animal identifier, species, barangay, and last record date.
- Preserve filters when returning from a detail page.
- Provide loading skeletons, empty states, no-result recovery, and retry states.
- Add pagination or cursor-based loading for large datasets.

Acceptance criteria:

- A technician can locate a known farmer or animal without trying multiple unrelated pages.
- Search results clearly distinguish animals with similar names or tags.
- Back navigation restores search and filters.
- Large lists do not fetch the full database into the browser.

Estimated contribution: 5 percentage points.

## Phase 3: Web Farmer Profile and Animal Workspace

Goal: make the animal—not the backend collection—the center of record work.

Tasks:

- Reorganize Farmer Profile into identity, contact/location, herd summary, animals, and recent activity.
- Provide clear actions: Register Animal, View Animals, and Add Record.
- Build or complete the Animal Profile workspace.
- Keep an animal context header visible: tag/ID, owner, species, sex, age, and reproductive state.
- Create a unified chronological Animal History.
- Combine AI, pregnancy, calving, health, and notes into a consistent event-card model.
- Add filters by record type, service date, and entered date.
- Link each event to a detailed record view.
- Clearly separate official records, requests, tasks, and notes.

Acceptance criteria:

- All official history for one animal is available from one workspace.
- A request is not visually misrepresented as a completed service.
- Dates and status labels use the shared vocabulary.
- Technician and farmer ownership/attribution are visible.

Estimated contribution: 6 percentage points.

## Phase 4: Web Contextual Add Record Workflow

Goal: enable reliable current and historical record entry from the animal context.

Tasks:

- Add a contextual Add Record menu to Animal Profile.
- Support AI, health, pregnancy diagnosis, calving, and general notes according to permissions.
- Prefill farmer and animal identity.
- Support actual service dates for past records.
- Show lifecycle warnings before submission.
- Prevent double submission and clearly show pending state.
- Return to the same animal history after success.
- Add the event immediately only after canonical success, or mark it Waiting to Sync when queued.
- Use human-readable backend validation messages.

Acceptance criteria:

- Technician can add each supported record without re-searching for the farmer or animal.
- Past dates persist accurately and are distinguishable from creation timestamps.
- Impossible lifecycle transitions are rejected consistently by backend and explained by UI.
- Repeated clicks do not create duplicate records.

Estimated contribution: 5 percentage points.

## Phase 5: Requests, Schedule, Tasks, and Records Alignment

Goal: eliminate uncertainty about planned work versus completed work.

Tasks:

- Define Service Requests as incoming future work.
- Define Schedule as dated planned visits.
- Define Tasks as operational work assignments where still necessary.
- Define Records as completed historical events.
- Ensure completing a request creates or links to exactly one official record.
- Show cross-links among request, task/schedule, animal, and resulting record.
- Standardize status chips and transitions across web and mobile.
- Remove UI actions that bypass canonical transition rules.

Acceptance criteria:

- A completed request always points to its official record.
- A record can exist without a prior request for walk-in or historical entry.
- Status shown on web and mobile agrees after refresh.
- No workflow performs duplicate writes.

Estimated contribution: 3 percentage points.

## Phase 6: Mobile Workflow Completion

Goal: make mobile behavior match the canonical product model while remaining field-friendly.

Tasks:

- Align mobile navigation and labels with the product vocabulary.
- Confirm technician farmer search and animal search use canonical endpoints.
- Ensure all official record forms begin with explicit farmer and animal context.
- Migrate every remaining manual connectivity wrapper to the shared offline executor.
- Decide which queued entities need optimistic temporary cards.
- Ensure forms close/reset after a successful queue operation.
- Preserve entered values when validation fails.
- Display server validation errors as strings, never raw objects.
- Verify farmer-side record detail shows technician-created history consistently.
- Clarify the purpose of Register Farmer versus Add Record throughout mobile copy.

Acceptance criteria:

- No technician mutation remains stuck loading solely because the device is offline.
- Every queued mutation gives finite, non-blocking confirmation.
- No `[object Object]`, raw error object, or React text rendering error appears.
- Mobile and web use the same status meanings and record ownership rules.

Estimated contribution: 4 percentage points.

## Phase 7: Offline Queue and Synchronization Hardening

Goal: make offline recording trustworthy under real network conditions.

Tasks:

- Confirm all queued operations carry stable idempotency keys.
- Define ordering and dependencies, such as farmer before animal and animal before record.
- Prevent a child mutation from syncing before its temporary parent ID is resolved.
- Add retry classification: network, authentication, validation, conflict, and permanent failure.
- Never retry permanent validation errors indefinitely.
- Show queue count and item-level state in Sync Center.
- Let the user retry or inspect failed items without deleting data accidentally.
- Ensure the persistent offline indicator does not cover action toasts.
- Deduplicate reconnect-triggered sync attempts.
- Test app restart, token refresh, partial batch success, and response-loss scenarios.

Acceptance criteria:

- Offline farmer registration redirects immediately after local save.
- Dependent animal and record operations synchronize in order.
- Replaying the same queue item cannot create duplicates.
- Failed items explain what the technician must change.
- Reconnecting does not produce overlapping or misleading toast messages.

Estimated contribution: 3 percentage points.

## Phase 8: API Consistency, Pagination, Realtime, and Security

Goal: prepare the shared platform for production data volume and multi-user use.

Tasks:

- Standardize success, validation-error, conflict, and pagination response shapes.
- Enforce pagination on farmer, animal, request, task, and record collections.
- Confirm authorization at the record and animal ownership level.
- Verify technician/admin permissions for historical entries and corrections.
- Add audit logs for sensitive record changes.
- Verify realtime invalidation and push notifications do not create duplicate UI events.
- Review rate limiting, upload validation, environment configuration, and production logging.
- Remove or protect debug/test routes.

Acceptance criteria:

- Web and mobile do not require endpoint-specific error parsing for common cases.
- Unauthorized users cannot read or mutate another farmer’s private records.
- Lists remain responsive at realistic data volumes.
- Realtime updates converge to server truth after reconnect.

Estimated contribution: 3 percentage points.

## Phase 9: Accessibility, Responsive Design, and UI Quality

Goal: make the system usable in the office and in field conditions.

Tasks:

- Verify contrast, keyboard navigation, focus order, labels, and error associations on web.
- Verify touch targets, safe areas, scrolling, keyboard avoidance, and small-screen layout on mobile.
- Use consistent loading, empty, offline, error, success, and disabled states.
- Centralize mobile query-error feedback: one deduplicated screen-level notice
  per outage, stable toast IDs for user actions, and no toast from background
  retries or every member of a multi-query screen.
- Test translated button and navigation labels in English, Filipino, and
  Hiligaynon for wrapping, alignment, touch targets, and small-screen fit.
- Keep Farmer Records record-first: AI assistance is optional, recent-activity
  filters use compact dropdown controls, and decorative banners do not obstruct
  the primary history workflow.
- Provide user-visible support ticket history and status tracking, not only an
  administrator queue.
- Use one canonical health urgency vocabulary across mobile, web, API
  validation, analytics, and persistence; map legacy `critical` safely to the
  canonical emergency value.
- Avoid toast-only critical information; preserve important status in the screen.
- Test long farmer names, missing photos, missing optional fields, and large histories.
- Reduce existing lint warnings that affect hooks, stale data, or runtime behavior.

Acceptance criteria:

- Core web workflows are usable at common laptop and tablet widths.
- Core mobile workflows are usable on representative Android screen sizes.
- Forms identify the exact field requiring correction.
- No persistent banner covers interactive controls or transient feedback.

Estimated contribution: 2 percentage points.

## Phase 10: Full End-to-End Release Validation

Goal: prove the product works as one connected system.

Required role matrix:

- Technician on web
- Technician on mobile online
- Technician on mobile offline then reconnecting
- Farmer on mobile
- Admin where approval or correction permissions apply

Required record matrix:

- Farmer registration
- Animal registration
- AI request and walk-in AI record
- Pregnancy diagnosis
- Calving and offspring creation
- Health request and manual health record
- Past record entry
- General note where supported

Required edge cases:

- Duplicate submit
- Lost response after server success
- Expired authentication while queued
- Validation error during sync
- Parent entity still temporary
- Existing legacy status record
- Two technicians attempting the same assignment
- App restart with queued records
- Web refresh during mutation
- Farmer viewing the completed technician record

Acceptance criteria:

- All critical paths pass on a clean development database seeded with representative data.
- No critical or high-severity defects remain.
- Automated checks pass from documented commands.
- A release checklist, rollback procedure, and known-issues list exist.

Estimated contribution: 2 percentage points.

## 8. Manual Test Checklist

### Technician web

- Sign in and confirm technician-only navigation.
- Search for farmer by name, phone, and barangay.
- Search for animal by ID and ear tag.
- Open farmer, animal, and record details using browser back/forward.
- Add every supported record type.
- Add a past record and verify both dates.
- Complete a request and confirm one official record.
- Check loading, no results, validation, conflict, and server-error states.
- Test keyboard-only navigation and tablet width.

### Technician mobile online

- Repeat farmer/animal discovery.
- Register farmer and animal.
- Add every supported official record.
- Verify form closes, cache refreshes, and record appears.
- Verify all errors render as readable text.
- Verify web shows the same result.

### Technician mobile offline

- Launch online, authenticate, and cache required reference data.
- Disable connectivity.
- Register a farmer, animal, and dependent record.
- Confirm each operation queues and the UI does not hang.
- Restart Expo Go and confirm the queue remains.
- Reconnect and verify ordered synchronization.
- Confirm one server entity per queued action.
- Inspect and recover from a deliberate validation failure.

### Farmer mobile

- View owned animals and histories.
- Submit AI and health service requests.
- Confirm requests are not shown as completed records.
- Confirm technician-completed services appear correctly.
- Confirm farmer cannot mutate protected technician records.
- Verify notification links open the correct animal or record.

## 9. Implementation Rules

- Web-first UI work must not create web-only backend semantics.
- Backend remains the authority for lifecycle and status transitions.
- Mobile offline logic may predict UI state but cannot redefine domain rules.
- Preserve compatibility routes during migration; remove them only after usage is measured.
- Never perform production database migration without a verified backup.
- Add tests before removing compatibility behavior.
- Do not mix broad visual redesign with transactional workflow changes in one release unit.
- Keep changes small enough to verify and roll back.

## 10. Progress Reporting

After each phase, update this document with:

- completion date;
- files or modules affected;
- tests executed and results;
- manual scenarios passed;
- known issues;
- revised overall completion percentage.

A phase is not complete merely because code was written. It is complete when its acceptance criteria pass.

## 11. Recommended Immediate Order

Before continuing the long-term phase order, run a temporary presentation
readiness sprint for the upcoming progress review:

1. Farmer mobile presentation flow.
2. Technician mobile presentation flow.
3. Technician web farmer-animal-record workflow.
4. Admin web Dashboard, Users, Animals, Records, Request Monitoring, and
   Support Tickets.
5. Shared responsive, language, state, and demo-data QA.

This sprint changes priority, not completion status. Offline hardening,
security, pagination, production operations, and full release validation remain
open after the review.

1. Phase 0: backup, development migration, route/endpoint inventory.
2. Phase 1: web navigation and terminology.
3. Phase 2: web farmer and animal discovery.
4. Phase 3: unified animal workspace and history.
5. Phase 4: contextual current/past record entry.
6. Phase 5: requests, schedule, tasks, and records alignment.
7. Phase 6: mobile workflow completion and web/mobile terminology consistency.
8. Phase 9: accessibility, responsiveness, and UI-state consistency.
9. Phase 7: return to deferred offline queue and synchronization hardening.
10. Phase 8: API consistency, pagination, realtime, security, and operations.
11. Phase 10: full release validation.

The reordered sequence does not remove offline support from scope. The known
offline farmer-registration loading defect remains an unresolved release
blocker, but it no longer blocks usability and workflow-consistency work.

## 12. Definition of 100% Complete

The project reaches 100% for this roadmap when:

1. A technician can find any farmer or animal quickly on web and mobile.
2. The full official history of one animal is available from one clear workspace.
3. Current and past records can be added without confusing them with registration or service requests.
4. Offline submissions save locally, close normally, synchronize safely, and never duplicate.
5. Farmers see the same official record truth with appropriate permissions.
6. Backend lifecycle rules and transactions are canonical and consistently used.
7. Navigation, terminology, statuses, dates, and errors agree across platforms.
8. Automated and manual release matrices pass.
9. Database migration, security, observability, backup, and rollback procedures are verified.
10. No unresolved critical or high-severity defect remains in the defined workflows.

## 13. Related Detailed Documents

- `docs/workflow-and-offline-consolidation-plan.md`
- `docs/web-technician-ui-improvement-plan.md`
- `docs/mobile-production-readiness-phases.md`
- `docs/web-production-cleanup-phases.md`
- `docs/mobile-web-technician-admin-gap-audit.md`
- `docs/task-vs-official-service-record-audit.md`
- `docs/record-ai-flow-cleanup-plan.md`
- `docs/remaining-work-and-manual-test-guide.md`

## 14. Implementation Progress

### 2026-07-11: Phase 0 partial and Phase 1 terminology pass

Completed:

- Created `docs/phase-0-route-endpoint-inventory.md` for active technician web routes and principal canonical mutations.
- Reordered technician navigation so farmer and animal discovery precedes specialized record pages.
- Renamed the record group and focused destinations using plain-language service labels.
- Aligned browser titles with visible technician navigation labels.
- Replaced technical page headings such as Clients, Operational Inbox, Deployment Schedule, and GIS Field Hub.
- Preserved every existing technician URL and specialized record page.

Still required before Phase 0 is complete:

- Verify a development database backup.
- Run and verify the status-vocabulary migration in development.
- Expand the endpoint inventory for farmer-mobile mutations.

Phase 1 remains subject to verification and responsive manual testing before it is marked complete.

### 2026-07-12: Phases 2-5 implementation audit and repair

Code-level outcomes:

- Phase 2 discovery uses URL-backed search, filters, sorting, and server pagination.
- Phase 3 provides a unified animal timeline with text, type, and service-date filters.
- Phase 4 supports contextual current/past AI, pregnancy, calving, and health entry with date validation.
- Phase 5 links pregnancy and calving tasks to official records inside the same transaction.
- Legacy animal status filters were restored to canonical compatibility behavior.
- Medical-history reads now enforce animal-level farmer authorization.

Verification and corrections are documented in `docs/phases-2-5-verification-audit.md`.

The overall estimate is raised conservatively to 76%. Responsive authenticated QA, database-backed end-to-end testing, Expo offline dependency testing, migration, and production-readiness work remain incomplete.

### 2026-07-12: Phases 6-7 offline reliability continuation

- Added `docs/mobile-offline-mutation-inventory.md`.
- Authentication failures no longer consume the offline retry budget or permanently fail queued user data.
- Farmer and technician Sync Center Retry actions now immediately run the queue instead of only changing the item state.
- A technician can continue from an offline-saved farmer directly into animal registration; the temporary farmer ID creates an ordered queue dependency.
- Confirmed queue support for temporary-ID mapping, dependencies, file persistence, stale-sync recovery, retry classification, and concurrency protection.

Real-device dependency-chain and session-refresh testing are still required before Phases 6-7 can be marked complete.

### 2026-07-12: Full master-plan completion audit

| Phase | Verified status | Conservative completion |
|---|---|---:|
| Phase 0: Release baseline | Partial | 45% |
| Phase 1: Web navigation and terminology | Implemented, manual responsive QA missing | 80% |
| Phase 2: Farmer and animal discovery | Mostly implemented, recent-activity filter and authenticated QA missing | 85% |
| Phase 3: Farmer/animal workspace | Mostly implemented, entered-date filter and general notes missing | 80% |
| Phase 4: Contextual record entry | AI, health, pregnancy, and calving implemented; general-note entry and full manual proof missing | 78% |
| Phase 5: Request/task/record alignment | Pregnancy and calving transactionally linked; AI/health linkage needs explicit proof | 75% |
| Phase 6: Mobile workflow completion | Shared offline handling broadly adopted; terminology, duplicate route ownership, and device QA remain | 75% |
| Phase 7: Offline hardening | Core engine implemented; animal-to-record chain, token resume, response-loss, and attachment recovery tests remain | 68% |
| Phase 8: API/security/production consistency | Started | 45% |
| Phase 9: Accessibility/responsive quality | Partial, not systematically verified | 30% |
| Phase 10: End-to-end release validation | Automated baseline only; manual matrix incomplete | 20% |

Forgotten or previously undercounted areas:

- Development database backup and status-vocabulary migration evidence.
- Full farmer-mobile route-to-endpoint inventory.
- Recent-activity discovery filter.
- Animal History filtering by entry date, separate from service date.
- General Note in the contextual Add Record menu.
- Explicit AI and health task/request-to-official-record cross-link tests.
- Offline animal-to-official-record temporary-ID dependency handoff.
- Automatic queue resume after Clerk authentication refresh.
- Response-loss, partial-batch, app-restart, and missing-attachment device tests.
- Consistent API mutation/error envelopes across older endpoints.
- Audit logs for historical record creation/correction.
- Realtime/push duplicate-event testing.
- Full keyboard, contrast, touch-target, tablet, and small-Android QA.
- Release checklist, rollback procedure, known-issues list, and clean-database role matrix.

The overall estimate was corrected from 76% to 72% because code implementation alone does not satisfy manual, migration, security, and release acceptance criteria.

### 2026-07-14: AI re-insemination and health-case integrity implementation

Implemented:

- AI attempts now form an explicit chain using `previousAttemptId`, `attemptSeriesId`, and performed-attempt numbering.
- Cancelled and rejected requests no longer consume an official attempt number.
- Re-insemination requires the latest performed attempt to have a verified failed outcome.
- Farmer possible-pregnancy reporting no longer creates or confirms a Pregnancy record; technician diagnosis remains authoritative.
- Farmer return-to-heat and technician negative/return-to-heat diagnoses record explicit confirmation sources.
- Re-insemination reuses the AI form in a locked contextual mode and appears on mobile/web technician request boards with attempt continuity.
- Health duplicate protection now covers the full active lifecycle and is enforced atomically per animal and request type.
- Resolved walk-in health requests and their medical records are created in one transaction.
- Soft-deleted AI and health cases release their active uniqueness keys.
- Added dry-run-first health active-case migration support and automated regression coverage.

Manual acceptance remains required. The canonical scenarios and evidence checklist are in `docs/ai-reinsemination-health-manual-test-plan.md`. These changes improve Phase 5 and Phase 6 implementation confidence, but do not mark either phase complete until authenticated device, database migration, and end-to-end tests pass.
