# BreedSmart Mobile Production Readiness Phases

This document converts the latest mobile audit into a phased fixing plan for `mobile`.

Current estimate:

- Overall mobile completion: about 72%.
- Remaining work: about 28%.
- Goal: reach controlled pilot readiness first, then production readiness.

Scope:

- Farmer mobile app.
- Technician mobile app.
- Admin mobile screens only if they are still intended for release.
- Do not rename folders or change backend contracts unless explicitly required.
- Keep the current BreedSmart identity, existing navigation direction, and technician-led workflow.

Important current context:

- `backend_2.0` and `mobile_2.0` were already promoted back to `backend` and `mobile`.
- Old folders should be treated as backups only.
- The active mobile target is `C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\mobile`.
- Do not blindly push the repository while hundreds of files are untracked.

---

## Phase 0: Repository And Release Safety

### Goal

Make sure the project state is clean before fixing application behavior.

### Why This Comes First

If the repo contains untracked generated files, backup folders, stale files, or accidental edits, later fixes may be mixed with unsafe changes. This phase prevents accidental GitHub pushes and release builds with unwanted files.

### Tasks

- Review `git status --short`.
- Categorize untracked files:
  - real app source files
  - docs/plans
  - generated files
  - old backup folders
  - accidental temporary files
- Confirm `.gitignore` excludes:
  - `node_modules`
  - `.expo`
  - build outputs
  - logs
  - private env files
  - local cache folders
  - generated native build folders if not intentionally tracked
- Confirm active folders are:
  - `mobile`
  - `backend`
  - `web`
- Confirm backup folders are not imported by active code.
- Run:
  - `cd mobile && npx tsc --noEmit`
  - `cd mobile && npm run lint`

### Acceptance Criteria

- No accidental backup or generated folders are staged.
- TypeScript passes.
- Lint has no release-blocking errors.
- A human-reviewed list of files to commit exists.

### Antigravity Prompt

```text
Read docs/mobile-production-readiness-phases.md.

Implement Phase 0 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\mobile

Do not change application behavior yet.
Do not delete old backup folders unless explicitly approved.
Do not stage or commit files.

Tasks:
1. Inspect git status.
2. Categorize untracked files into app source, docs, generated/cache, backup, and accidental files.
3. Check .gitignore coverage for mobile/backend/web generated files and secrets.
4. Run mobile TypeScript and lint checks.
5. Report exactly what is safe to keep, what should be ignored, and what needs user approval before deletion.

Stop after reporting. Do not proceed to Phase 1A.
```

---

## Phase 1A: Data Integrity And Workflow Rule Bugs

### Goal

Fix record-correctness bugs before UI polish or broad offline work.

### Why This Comes Before UI Work

If pregnancy, insemination, or health records are calculated or validated incorrectly, the app can create misleading livestock history. UI cleanup should not happen before the core animal-record rules are safe.

### Tasks

- Fix pregnancy check estimated calving date logic:
  - do not calculate from `Date.now()`
  - use the related insemination date
  - use species-specific gestation days from `cattleCore`
  - keep wording as estimated, not guaranteed
- Verify backend walk-in AI validation:
  - animal must be female
  - animal must meet breeding-age rules
  - animal must not be pregnant
  - animal must not be inside postpartum/voluntary waiting period
  - animal must not have an active duplicate AI workflow
- Verify newly registered walk-in AI animals have a safe gender value:
  - default to female only when the form/workflow clearly represents an inseminated female
  - otherwise require explicit gender selection before AI can be saved
- Verify PD follow-up timing:
  - automatic pregnancy diagnosis tasks should be based on insemination date
  - too-early manual verification should warn or block based on product rules
  - duplicate PD tasks for the same insemination should be prevented
- Verify notification polling:
  - remove or reduce 5-second `/notifications` polling
  - prefer push notifications, focus refresh, query invalidation, or slower unread-count refresh
- Verify direct record mutations that may need idempotency:
  - record AI
  - pregnancy check
  - calving
  - health log
  - request status changes

### Known Areas To Inspect

- `mobile/app/(technician)/pregnancy-check.tsx`
- `mobile/app/(technician)/record-ai.tsx`
- `mobile/app/(technician)/pregnancy-verification.tsx`
- `mobile/app/(technician)/record-calf-drop.tsx`
- `mobile/app/(farmer)/record-calving.tsx`
- `mobile/app/notifications.tsx`
- `mobile/lib/cattleCore.ts`
- `backend/src/utils/cattleCore.js`
- `backend/src/controllers/technician.controllers.js`
- `backend/src/controllers/ai-request.controllers.js`
- `backend/src/controllers/animals.controllers.js`

### Acceptance Criteria

- Estimated calving dates use insemination date plus species gestation rules.
- Backend refuses invalid walk-in AI records with clear messages.
- Duplicate or too-early PD follow-ups are controlled.
- Notification refresh no longer uses aggressive 5-second polling.
- TypeScript and lint have no release-blocking errors.

### Antigravity Prompt

```text
Read docs/mobile-production-readiness-phases.md.

Implement Phase 1A only.

Targets:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\mobile
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\backend

Goal:
Fix data-integrity and workflow-rule bugs before UI/offline polish.

Do not redesign screens.
Do not refactor large files unless necessary to fix the bug safely.
Do not change folder names.
Keep technicians as the current handlers for AI, health assistance, pregnancy checks, and calving.

Tasks:
1. Fix pregnancy-check estimated calving date so it uses the related insemination date plus species-specific gestation from cattleCore, not Date.now() + 280.
2. Verify and enforce backend walk-in AI validation:
   - female animal only
   - breeding-age eligible
   - not pregnant
   - not inside postpartum/voluntary waiting period
   - no active duplicate AI workflow
3. Verify walk-in animal registration cannot create an animal that bypasses later gender checks.
4. Verify automatic PD follow-up timing is based on insemination date and cannot create duplicate tasks for the same insemination.
5. Remove or reduce 5-second notifications polling; prefer focus refresh, push/event invalidation, or a safer slower unread-count refresh.
6. Check record mutations for idempotency support or duplicate-submit protection.
7. Run mobile TypeScript and lint.
8. Run backend tests if available.

Report:
- files changed
- validation rules confirmed
- bugs fixed
- tests/checks run
- any remaining backend contract gaps

Stop after Phase 1A.
```

---

## Phase 1B: Critical Broken Actions And Release Blockers

### Goal

Fix visible broken interactions and release-blocking behavior before polishing UI.

### Tasks

- Search for empty actions:
  - `onPress={() => {}}`
  - `onPress={undefined}`
  - placeholder buttons
  - disabled buttons without explanation
- Fix or remove no-op actions.
- Add missing loading states to submit buttons that trigger network or offline mutations.
- Add disabled states to prevent duplicate taps.
- Add success/error handling to actions that mutate data.
- Verify destructive actions use confirmation dialogs:
  - cancel request
  - decline request
  - delete/remove
  - discard failed offline item
- Confirm action outcomes:
  - success toast
  - error toast
  - queued offline toast
  - retryable failure state

### Known Areas To Inspect

- Technician profile actions.
- Technician Moowie/helper card actions.
- Request detail actions.
- Health request actions.
- Task/visit actions.
- Farmer request cancellation.
- Offline retry/discard actions.

### Acceptance Criteria

- No visible button does nothing.
- Every mutation button has loading and disabled states.
- Destructive actions ask for confirmation.
- Success/error/queued states are visible to the user.

### Antigravity Prompt

```text
Read docs/mobile-production-readiness-phases.md.

Implement Phase 1B only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\mobile

Focus on broken actions and release blockers.
Do not redesign screens.
Do not refactor large screens unless needed to fix the action safely.

Tasks:
1. Search for no-op handlers such as onPress={() => {}} and placeholder buttons.
2. Fix each no-op by connecting the correct route/action, removing the button, or showing a clear disabled reason.
3. Add loading/disabled states to mutation buttons where missing.
4. Add confirmation dialogs for destructive actions.
5. Add success/error/queued offline feedback where an action currently gives no feedback.
6. Run npx tsc --noEmit.
7. Run npm run lint.

Report every file changed and every action fixed.
Stop after Phase 1B.
```

---

## Phase 2: Pagination, Payload Size, And List Performance

### Goal

Prevent slow screens and memory problems as real farmer/animal/record data grows.

### Why This Matters

The app currently has places that fetch large lists, including `limit=1000` and `limit=100`. That is okay for demos but risky for real use across multiple municipalities.

### Tasks

- Replace large fetches with paginated queries.
- Add page controls or infinite loading where appropriate.
- Add pull-to-refresh where the user expects it.
- Add search/filter parameters instead of fetching everything and filtering locally.
- Add visible total count or loaded count where useful.
- Add empty/loading/error states for paginated lists.

### Priority Screens

- Farmer My Animals.
- Technician Animal Hub.
- Animal timeline.
- Medical history.
- Detailed records.
- Technician Records & Reports.
- Admin users.
- Admin animals.
- Admin records if applicable.

### Known Patterns To Replace

- `limit=1000`
- `limit=100`
- fetching all health requests for records
- fetching all animals for picker screens without search/pagination

### Acceptance Criteria

- No production screen fetches huge data by default.
- Animal lists default to about 10 items per page.
- Records/timelines use pagination or incremental loading.
- Search and filters work with pagination.
- Pull-to-refresh still works.

### Antigravity Prompt

```text
Read docs/mobile-production-readiness-phases.md.

Implement Phase 2 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\mobile

Goal:
Add long-term-safe pagination and reduce large mobile payloads.

Do not change the visual design heavily.
Do not remove existing filters.
Do not break current API compatibility. If backend pagination is missing for an endpoint, add a safe frontend fallback and report the backend gap.

Tasks:
1. Search for limit=1000, limit=100, and list screens that fetch all records.
2. Prioritize Farmer My Animals, Technician Animal Hub, Animal Timeline, Medical History, Detailed Records, Technician Records & Reports, Admin Users, and Admin Animals.
3. Add pagination or infinite loading with a default limit around 10 for animals and sensible limits for records.
4. Keep search/filter state compatible with pagination.
5. Add loading, empty, error, refresh, and end-of-list states.
6. Run npx tsc --noEmit.
7. Run npm run lint.

Report:
- endpoints changed
- screens changed
- remaining backend pagination gaps
- any endpoint still using a large limit and why

Stop after Phase 2.
```

---

## Phase 3: Shared Loading, Empty, Error, Offline, And Success States

### Goal

Make the app feel stable and premium by replacing inconsistent loading/error behavior.

### Tasks

- Standardize shared states:
  - skeleton loading
  - empty state
  - error state with retry
  - offline stale-data state
  - success confirmation
  - queued offline state
  - failed sync state
- Replace centered spinners on important screens with layout-matching skeletons.
- Keep spinners only for tiny inline actions.
- Ensure pull-to-refresh indicators are present where lists refresh.

### Priority Screens

- Farmer Home.
- My Animals.
- Animal Profile.
- My Requests.
- Request AI.
- Report Health Concern.
- Technician Home.
- Request Board.
- My Work Queue.
- Visit Calendar.
- Records & Reports.
- Health Log.
- Record AI.
- Admin dashboards if active.

### Acceptance Criteria

- Major screens no longer show only a blank spinner.
- Every data screen has loading, empty, error, retry, and refresh behavior.
- Offline states are understandable.
- Success and queued states are visually distinct.

### Antigravity Prompt

```text
Read docs/mobile-production-readiness-phases.md.

Implement Phase 3 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\mobile

Goal:
Standardize loading, empty, error, offline, and success states across key mobile screens.

Use existing shared components if present before creating new ones.
Do not introduce a second component library.
Do not redesign navigation.

Tasks:
1. Inspect existing shared state components such as AsyncState, skeleton components, SuccessSheet, SyncBanner, and related UI utilities.
2. Replace full-screen ActivityIndicator usage on major screens with layout-matching skeletons.
3. Add missing empty states and retry states.
4. Add offline stale-data messaging where cached data is shown.
5. Add success/queued/failed-sync states to forms and offline mutations.
6. Run npx tsc --noEmit.
7. Run npm run lint.

Report:
- screens improved
- shared components reused
- screens still needing state work

Stop after Phase 3.
```

---

## Phase 4: Workflow Verification And Business Logic Alignment

### Goal

Make sure app workflows match how BreedSmart is actually used in the field.

### Core Product Rule

Technicians handle:

- AI service.
- Health assistance.
- Pregnancy checks.
- Calving records.
- Farmer records.
- Animal records.
- Follow-ups.
- Farm visits.

Do not build a separate veterinarian workflow for this release.

### Tasks

- Verify each workflow end-to-end:
  - farmer requests AI
  - farmer reports health concern
  - farmer reports breeding observation
  - technician claims request
  - technician declines request
  - technician schedules visit
  - technician records AI
  - automatic PD follow-up is created only when appropriate
  - technician performs pregnancy check
  - technician records calving
  - technician logs health assistance
  - completed work appears in Records & Reports
  - scheduled work appears in Visit Calendar
  - upcoming visits appear on Farmer Home
- Ensure request statuses match between Farmer, Technician, Calendar, and Records.
- Ensure task vs official service record boundaries are clear:
  - Task = planning/reminder/visit.
  - Official record = AI, health, pregnancy check, calving, treatment, diagnosis, offspring.
- Ensure request board behavior:
  - pending available work appears on Request Board.
  - claimed work moves to My Work Queue.
  - declined requests behave correctly and do not disappear incorrectly for everyone unless that is intended.

### Acceptance Criteria

- Farmer and technician see the same truth for request status.
- Visit Calendar is read-only for schedules and opens correct details.
- Records & Reports show completed official service records.
- Task completion redirects to official forms when the task is service-related.
- No workflow creates duplicate official records accidentally.

### Antigravity Prompt

```text
Read docs/mobile-production-readiness-phases.md.

Implement Phase 4 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\mobile

Goal:
Verify and fix workflow alignment across Farmer and Technician mobile flows.

Do not add a veterinarian dashboard.
Keep technicians as the users who handle AI, health assistance, pregnancy checks, calving, visits, and records.

Tasks:
1. Audit the full lifecycle of AI request, health request, breeding observation, PD follow-up, farm visit, calving, and records.
2. Confirm statuses are consistent across Farmer Home, My Service Requests, Technician Request Board, My Work Queue, Visit Calendar, and Records & Reports.
3. Fix cases where scheduled work appears in one screen but not another.
4. Fix task vs official service record confusion.
5. Ensure service-related task completion opens the official form instead of only marking a task complete.
6. Verify automatic PD follow-up timing and duplicate prevention.
7. Run npx tsc --noEmit.
8. Run npm run lint.

Report:
- each workflow tested
- bugs fixed
- remaining backend contract gaps
- any status names that still need backend normalization

Stop after Phase 4.
```

---

## Phase 5: Offline-First Completion

### Goal

Make the important field workflows reliable even with weak or no internet.

### Tasks

- Confirm offline queue support for:
  - farmer AI request
  - farmer health request
  - farmer calving/update
  - technician record AI
  - technician health log
  - technician pregnancy check
  - technician calving record
  - technician farm visit/task completion
- Ensure each queued mutation has:
  - stable mutation ID
  - idempotency key
  - payload version
  - status
  - retry count
  - last error
  - created timestamp
  - attachment handling if photos are included
- Ensure queued photos are stored as managed local files, not large base64 payloads in AsyncStorage.
- Add UI for:
  - pending count
  - sync history
  - failed item list
  - retry
  - edit
  - discard

### Acceptance Criteria

- Field-critical forms can be queued offline.
- Users understand what is pending, synced, or failed.
- Duplicate taps do not create duplicate backend records.
- Failed sync can be retried or discarded.
- Photos survive app restart before sync.

### Antigravity Prompt

```text
Read docs/mobile-production-readiness-phases.md.

Implement Phase 5 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\mobile

Goal:
Complete offline-first coverage for field-critical mobile workflows.

Do not rewrite the offline queue if it already exists.
Extend the current offlineQueue/useOfflineMutation approach.

Tasks:
1. Audit which farmer and technician forms already use the offline queue.
2. Add offline queue support to missing critical forms:
   - farmer AI request
   - farmer health request
   - farmer calving/update
   - technician record AI
   - technician health log
   - technician pregnancy check
   - technician calving record
   - technician farm visit/task completion
3. Ensure idempotency keys are sent.
4. Ensure queued photos use managed local files.
5. Add or improve Sync History and Failed Sync UI.
6. Test offline submit, app restart, reconnect, retry, and failed upload.
7. Run npx tsc --noEmit.
8. Run npm run lint.

Report:
- workflows now offline-safe
- workflows still online-only and why
- sync failure cases tested

Stop after Phase 5.
```

---

## Phase 6: Large Screen Refactor And API Layer Cleanup

### Goal

Make the mobile codebase maintainable long-term.

### Tasks

- Move raw API calls out of route files.
- Use:
  - feature service files for API calls
  - feature hooks for TanStack Query
  - small UI components for repeated sections
  - route files as shells only
- Stop converting query failures into empty arrays silently.
- Remove duplicate API calls.
- Improve query keys and invalidation.

### Priority Refactor Files

- `features/animals/screens/AnimalDetailsScreen.tsx`
- `features/farmer-dashboard/screens/FarmerHomeScreen.tsx`
- `app/(technician)/animal-details.tsx`
- `app/(technician)/health-log.tsx`
- `app/(farmer)/report-sickness/index.tsx`
- `app/(farmer)/request-ai/index.tsx`
- `app/(technician)/request-details.tsx`
- `app/(technician)/create-task.tsx`
- `app/(technician)/record-ai.tsx`
- `features/technician-records/screens/TechnicianRecordsScreen.tsx`

### Acceptance Criteria

- Route files are shorter and easier to scan.
- API calls live in feature services.
- Query/mutation logic lives in hooks.
- UI components are reusable without becoming a second design system.
- Behavior remains the same after refactor.

### Antigravity Prompt

```text
Read docs/mobile-production-readiness-phases.md.

Implement Phase 6 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\mobile

Goal:
Refactor oversized screens and move direct API calls into feature services/hooks.

Do not change business behavior.
Do not redesign UI during this phase.
Refactor one screen at a time and verify after each screen.

Priority files:
1. features/animals/screens/AnimalDetailsScreen.tsx
2. features/farmer-dashboard/screens/FarmerHomeScreen.tsx
3. app/(technician)/animal-details.tsx
4. app/(technician)/health-log.tsx
5. app/(farmer)/report-sickness/index.tsx
6. app/(farmer)/request-ai/index.tsx
7. app/(technician)/request-details.tsx
8. app/(technician)/create-task.tsx
9. app/(technician)/record-ai.tsx
10. features/technician-records/screens/TechnicianRecordsScreen.tsx

Tasks:
1. For each selected screen, extract API calls into a service file.
2. Extract TanStack Query logic into hooks.
3. Extract repeated UI blocks into local feature components only when useful.
4. Preserve route params and navigation behavior.
5. Preserve current UI unless a tiny consistency fix is needed.
6. Run npx tsc --noEmit after each major screen.
7. Run npm run lint after the phase.

Report:
- before/after file sizes
- services/hooks/components created
- behavior verified
- remaining large files

Stop after Phase 6.
```

---

## Phase 7: UI Consistency And Accessibility Polish

### Goal

Make the app feel consistent, readable, and trustworthy.

### Tasks

- Standardize:
  - card radius
  - section spacing
  - typography scale
  - button height
  - input height
  - status badges
  - icon button sizes
  - dark mode colors
- Avoid excessive nested cards and heavy shadows.
- Ensure text wraps properly.
- Add accessibility labels to icon-only buttons.
- Ensure 44px minimum touch targets.
- Test on:
  - 360x800
  - 390x844
  - 412x915
- Test light and dark mode.

### Priority Screens

- Farmer Home.
- My Animals.
- Animal Profile.
- Request AI.
- Report Health Concern.
- Technician Home.
- Request Board.
- My Work Queue.
- Visit Calendar.
- Records & Reports.
- Admin screens if active.

### Acceptance Criteria

- UI feels like one app, not mixed prototypes.
- Text does not overflow.
- Buttons are readable and tappable.
- Dark mode is usable.
- Core screens look acceptable on small Android devices.

### Antigravity Prompt

```text
Read docs/mobile-production-readiness-phases.md.

Implement Phase 7 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\mobile

Goal:
Polish UI consistency and accessibility without changing workflows.

Do not replace the BreedSmart visual identity.
Do not adopt a completely new Stitch design system.
Use existing BreedSmart green palette, Outfit typography, and current navigation direction.

Tasks:
1. Audit Farmer, Technician, and active Admin screens for spacing, radius, typography, color, and component inconsistency.
2. Standardize status badges, buttons, cards, inputs, list rows, and empty states.
3. Fix text wrapping and overflow.
4. Add accessibility labels to icon-only buttons.
5. Ensure touch targets are at least 44px.
6. Verify 360x800, 390x844, and 412x915 layouts.
7. Verify light and dark mode.
8. Run npx tsc --noEmit.
9. Run npm run lint.

Report:
- screens polished
- visual rules applied
- screenshots or notes for small-screen checks
- remaining visual debt

Stop after Phase 7.
```

---

## Phase 8: Production Readiness Final Pass

### Goal

Prepare for APK/dev build testing and controlled pilot testing.

### Tasks

- Run:
  - TypeScript
  - lint
  - Expo start smoke test
  - Android dev build or APK build check
- Test:
  - farmer login
  - technician login
  - admin login if active
  - request AI
  - record AI
  - automatic PD follow-up
  - pregnancy check
  - health request
  - health log
  - farm visit
  - request claim/decline
  - records/reports
  - offline submit/reconnect
  - location update
  - push/in-app notifications if configured
- Add crash/error handling plan.
- Confirm environment variables.
- Confirm backend URL points to intended environment.
- Confirm app version/runtime version strategy.
- Confirm update notice strategy.

### Acceptance Criteria

- Mobile can be installed and tested by internal users.
- No known critical workflow bug remains.
- Offline behavior has been tested.
- Backend/mobile versions are aligned.
- Release notes and known limitations are documented.

### Antigravity Prompt

```text
Read docs/mobile-production-readiness-phases.md.

Implement Phase 8 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\mobile

Goal:
Run the final mobile production-readiness pass for controlled pilot testing.

Do not introduce new features in this phase.
Only fix release-blocking bugs discovered during verification.

Tasks:
1. Run TypeScript and lint.
2. Start Expo and smoke-test key routes.
3. Verify Farmer, Technician, and Admin login if Admin mobile is active.
4. Test the main workflows listed in Phase 8.
5. Verify offline submit, app restart, reconnect, retry, and failed sync.
6. Verify backend URL and environment variables.
7. Verify version/runtime/update-notice strategy.
8. Document remaining known limitations.

Report:
- pass/fail table for every workflow
- exact errors found
- fixes applied
- remaining blockers
- recommendation: not ready / internal testing ready / pilot ready

Stop after Phase 8.
```

---

## Recommended Order

Do the phases in this order:

1. Phase 0: repository safety.
2. Phase 1A: data integrity and workflow rule bugs.
3. Phase 1B: broken actions and release blockers.
4. Phase 2: pagination and payloads.
5. Phase 4: workflow verification.
6. Phase 3: shared states.
7. Phase 5: offline completion.
8. Phase 6: large screen refactor.
9. Phase 7: UI polish.
10. Phase 8: final release pass.

Reason:

- Safety comes first.
- Data-integrity bugs must be fixed before UI/offline polish because they can create misleading animal records.
- Broken actions and large payloads affect testing immediately.
- Workflow correctness should be confirmed before polishing.
- Offline and refactoring are deeper work.
- Final UI polish is most effective after behavior stabilizes.

---

## Definition Of Done For Mobile Pilot

The mobile app can be considered ready for controlled pilot testing when:

- TypeScript passes.
- Lint has no release-blocking errors.
- Pregnancy estimates use insemination date plus species gestation rules.
- Backend rejects invalid AI, pregnancy, and postpartum workflow transitions.
- Notification refresh no longer depends on aggressive 5-second polling.
- No visible button does nothing.
- Farmer and technician workflows work end-to-end.
- Large lists are paginated or safely limited.
- Critical forms have loading, disabled, success, error, and offline states.
- Offline queue works for field-critical forms.
- Records and reports show completed work correctly.
- Visit Calendar shows scheduled work correctly.
- Farmer Home shows upcoming visits correctly.
- Small Android layouts are usable.
- Known limitations are documented.
