# BreedSmart Web Production Cleanup And UI Modernization Phases

## Purpose

This document is the phased cleanup plan for the BreedSmart web application:

- Admin Dashboard
- Technician Dashboard
- Admin modules
- Technician modules
- Shared web layout, navigation, tables, modals, forms, notifications, and reports

The goal is to move the web app from internal-testing quality to production-ready quality without rewriting the system from scratch.

Current audit estimate:

- Overall readiness: about 72%
- Remaining work: about 28%
- Main blockers: workflow correctness, silent dashboard failures, oversized pages, large unpaginated data fetches, inconsistent UI patterns, thin tests, and incomplete production error handling

## Taste-Skill Usage Rule

Use `design-taste-frontend` before any UI redesign work.

Important context from the skill:

- The skill is strongest for redesign discipline, brand preservation, typography, spacing, color, interaction states, and anti-slop checks.
- The skill explicitly says dense dashboards and data tables need product-UI judgment, not marketing-page styling.
- Therefore, use taste-skill as an audit and visual-quality framework, but do not turn the admin/technician dashboards into landing pages.

Design read:

> Reading this as: internal municipal operations dashboards for admin and technician users, with a trust-first agricultural field-service language, leaning toward calm dense product UI with preserved BreedSmart branding.

Recommended taste-skill dials for this web app:

- `DESIGN_VARIANCE: 4`
- `MOTION_INTENSITY: 2`
- `VISUAL_DENSITY: 7`

Preserve:

- BreedSmart logo and identity
- Green primary accent
- Outfit typography unless intentionally self-hosted
- Current route structure
- Current primary navigation labels unless approved
- Existing admin and technician workflows
- Light and dark themes

Retire:

- Mixed visual languages between DaisyUI `base-*` and custom slate/emerald styling
- Random accent colors that are not tied to status meaning
- Decorative dashboard copy that makes operations harder to scan
- Oversized uppercase text in dense tables
- Silent empty dashboard fallbacks
- Huge client-side `limit=1000` data loading

## Phase 0: Safety Baseline And Verification

### Goal

Create a known-good baseline before changing workflows or UI.

### Tasks

- Run and record:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- Confirm current environment variables:
  - `VITE_API_URL`
  - Clerk publishable key if present
  - deployment target configuration
- Confirm web routes still point to the renamed production folders:
  - `backend`
  - `mobile`
  - `web`
- Confirm no secrets are committed in `web/.env`.
- List currently passing tests and test gaps.
- Capture screenshots of:
  - Admin Dashboard
  - Technician Dashboard
  - Admin Users
  - Admin Livestock
  - Admin Reports
  - Admin Monitoring
  - Technician Requests
  - Technician Breeding Ledger
  - Technician Reports
  - Technician Schedule
  - Technician Health
  - Technician Farmers Directory

### Acceptance Criteria

- Lint passes.
- Tests pass.
- Production build passes.
- Current screenshots are available for comparison.
- Known test gaps are listed.

### Antigravity Prompt

```text
Read docs/web-production-cleanup-phases.md.

Implement Phase 0 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\web

Do not change app behavior.
Do not redesign UI yet.

Run:
npm run lint
npm run test
npm run build

Then inspect the web environment and route setup.
Report all current warnings, test coverage gaps, build chunk concerns, and screenshots needed for visual comparison.

Stop after Phase 0.
```

## Phase 1: Critical Workflow Correctness

### Goal

Fix user-facing workflow bugs before visual cleanup.

### Critical Issues To Fix

1. `TaskActionModal` must use the correct workflow endpoint.
   - Health request actions should use health request endpoints.
   - AI request accept/schedule/cancel should use AI request endpoints.
   - Official AI service completion should create or update the correct insemination/service record.
   - Do not call `/technician/inseminations/:id/status` using an AI request id unless the backend contract explicitly expects that.

2. Technician request type mapping must not collapse unknown services into health.
   - Preserve and display:
     - AI
     - Health Assistance
     - Pregnancy Check
     - Calving
     - General Visit
     - Follow-up
   - Unknown type should show `Service` with safe fallback, not health.

3. Admin request monitoring must become a real admin-safe monitor.
   - `/admin/requests` currently reuses technician request UI.
   - Keep route if desired, but make mode explicit:
     - admin can view all
     - admin can assign/reassign when allowed
     - admin should not accidentally use technician self-profile logic
   - Remove unnecessary `/technician/profile` fetch in admin mode.

4. Decline/cancel/delete wording must match the actual backend action.
   - Decline should not hard-delete.
   - Drop/remove should not be used if the backend cancels.
   - Destructive actions need confirmation.

### Files To Inspect First

- `web/src/pages/technician/Requests.jsx`
- `web/src/components/modals/TaskActionModal.jsx`
- `web/src/components/modals/RescheduleCancelModal.jsx`
- `web/src/components/modals/AssignTaskModal.jsx`
- `backend` routes/controllers for:
  - `/technician/requests`
  - `/ai-request/:id/status`
  - `/ai-request/:id/cancel`
  - `/health-request/:id/status`
  - `/health-request/:id/triage`
  - official insemination record creation

### Acceptance Criteria

- A technician can accept an AI request.
- A technician can decline an AI request without deleting the record.
- A technician can complete an AI workflow through the official service flow.
- A technician can accept, triage, resolve, or cancel a health assistance request.
- Admin request monitor works without technician self-profile assumptions.
- Request board displays correct service type and status for every supported request type.

### Antigravity Prompt

```text
Read docs/web-production-cleanup-phases.md.

Implement Phase 1 only.

Target folders:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\web
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\backend

Goal:
Fix web workflow correctness before UI redesign.

Focus files:
- web/src/pages/technician/Requests.jsx
- web/src/components/modals/TaskActionModal.jsx
- web/src/components/modals/AssignTaskModal.jsx
- web/src/components/modals/RescheduleCancelModal.jsx

Rules:
- Do not redesign UI yet.
- Do not change routes unless required.
- Preserve existing admin and technician workflows.
- Do not treat unknown request types as health.
- Do not use an AI request id against an insemination endpoint unless backend confirms that is correct.

Tasks:
1. Verify the backend contracts for AI request, health request, pregnancy check, calving, and generic task actions.
2. Fix TaskActionModal endpoint selection and payloads.
3. Fix request type mapping in Requests.jsx.
4. Make admin request mode safe and remove technician self-profile assumptions in admin mode.
5. Make decline/cancel/delete labels match actual backend behavior.
6. Add or update focused tests for request actions if test setup allows it.
7. Run npm run lint, npm run test, and npm run build in web.

Stop after Phase 1 and report exact workflows tested.
```

## Phase 2: Dashboard Reliability And Partial Error States

### Goal

Prevent dashboards from silently showing false zeros or empty widgets when backend calls fail.

### Problems To Fix

- Admin dashboard uses `Promise.allSettled` and fallback empty values.
- Monitoring dashboard also uses fallback empty values.
- A failed endpoint can currently look like "no problem" instead of "data unavailable."

### Tasks

- Replace silent fallbacks with partial success metadata:
  - `ok`
  - `data`
  - `error`
  - `source`
- Show per-widget error cards when one dashboard section fails.
- Keep other widgets visible if their API calls succeed.
- Add retry action for each failed section or a global retry.
- Log failure details in dev console only.
- Never display `0` when the real state is "failed to load."

### Files To Inspect First

- `web/src/pages/admin/Dashboard.jsx`
- `web/src/pages/admin/Monitoring.jsx`
- `web/src/pages/technician/DashboardTechnician.jsx`
- `web/src/components/data/DashboardChart.jsx`
- `web/src/components/Skeleton.jsx`

### Acceptance Criteria

- Failed stats endpoint shows "Unable to load stats" instead of zero counts.
- Failed chart endpoint shows a retryable chart error state.
- Failed request queue endpoint shows an explicit queue error.
- Successful sections still render when unrelated sections fail.
- Technician dashboard shows failure feedback when dashboard-data or analytics fails.

### Antigravity Prompt

```text
Read docs/web-production-cleanup-phases.md.

Implement Phase 2 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\web

Goal:
Fix dashboard reliability and partial error states.

Focus files:
- src/pages/admin/Dashboard.jsx
- src/pages/admin/Monitoring.jsx
- src/pages/technician/DashboardTechnician.jsx
- src/components/data/DashboardChart.jsx
- src/components/Skeleton.jsx

Rules:
- Do not redesign the whole dashboard.
- Keep current cards and layout unless needed for clear error states.
- Do not show zero when data failed to load.

Tasks:
1. Replace silent Promise.allSettled empty fallbacks with explicit success/error wrappers.
2. Add per-section error states for failed dashboard modules.
3. Add retry buttons where useful.
4. Keep partial successful data visible.
5. Add skeletons where widgets currently show "...".
6. Run npm run lint, npm run test, and npm run build.

Stop after Phase 2.
```

## Phase 3: Backend Pagination And Data Contracts

### Goal

Stop loading large production datasets into the browser.

### Problems To Fix

Large client-side fetches exist in:

- `BreedingLedger.jsx`
- `Reports.jsx`
- `Inseminations.jsx`
- `Newborns.jsx`
- `TechnicianProfile.jsx`
- `RouteOptimizer.jsx`
- `Health.jsx`
- `Animals.jsx`
- `FarmersDirectory.jsx`

Examples:

- `/technician/inseminations?limit=1000`
- `/technician/pregnancy-checks?limit=1000`
- `/technician/calvings?limit=1000`
- `/ai-request?limit=1000`
- `/health-request?limit=1000`
- `/animals/all`

### Tasks

- Use backend pagination for all large tables.
- Use server search/filter/sort where available.
- Add missing backend query params only if needed:
  - `page`
  - `limit`
  - `search`
  - `status`
  - `type`
  - `barangay`
  - `municipality`
  - `fromDate`
  - `toDate`
  - `sortBy`
  - `sortOrder`
- Standardize response shape:
  - `{ data, page, limit, total, totalPages }`
- Update web table pagination to use backend totals.
- Keep client-side filtering only for tiny static lists.

### Acceptance Criteria

- No production page uses `limit=1000`.
- Tables show backend total counts.
- Search/filter does not require loading all records first.
- Pagination state is reflected in query keys.
- Table refresh works after mutations.

### Antigravity Prompt

```text
Read docs/web-production-cleanup-phases.md.

Implement Phase 3 only.

Target folders:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\web
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\backend

Goal:
Replace large client-side list fetches with backend pagination and server filters.

Priority files:
1. web/src/pages/technician/BreedingLedger.jsx
2. web/src/pages/technician/Reports.jsx
3. web/src/pages/technician/Inseminations.jsx
4. web/src/pages/technician/Newborns.jsx
5. web/src/pages/admin/TechnicianProfile.jsx
6. web/src/pages/admin/Inseminations.jsx
7. web/src/pages/admin/Livestock.jsx
8. web/src/pages/admin/Users.jsx

Rules:
- Do not break existing backend consumers.
- Add backward-compatible pagination support if backend endpoints are not ready.
- Do not load limit=1000 for production tables.
- Preserve current UI behavior while changing data source contracts.

Tasks:
1. Find every limit=1000 or load-all table call.
2. Add or use backend pagination/filter params.
3. Update query keys to include page/filter/sort.
4. Update table pagination to use backend totals.
5. Verify mutations invalidate the correct paginated queries.
6. Run backend tests if backend changed.
7. Run web lint, tests, and build.

Stop after Phase 3.
```

## Phase 4: Web Design System And Taste-Skill UI Pass

### Goal

Make the web app feel like one coherent BreedSmart product, not a collection of unrelated screens.

### Taste-Skill Required Step

Before editing UI, run a written Section 11-style audit:

- Brand tokens currently in use:
  - primary green
  - status colors
  - typography
  - radius scale
  - shadow style
- Information architecture:
  - admin routes
  - technician routes
  - shared modules
- Patterns to preserve:
  - BreedSmart identity
  - dense operational dashboard style
  - light/dark mode
  - current route names
- Patterns to retire:
  - inconsistent dropdowns
  - inconsistent table headers
  - mixed button shapes
  - too much uppercase text
  - random purple/blue accent usage
  - excessive card nesting
- Dial reading:
  - `DESIGN_VARIANCE: 4`
  - `MOTION_INTENSITY: 2`
  - `VISUAL_DENSITY: 7`

### UI Rules

- Preserve current URLs.
- Preserve primary nav labels unless approved.
- Preserve form field names and order unless a workflow bug requires adjustment.
- Preserve logo and green accent.
- Do not create marketing-page hero layouts inside dashboards.
- Use one radius system:
  - Cards: `rounded-2xl` or one chosen standard
  - Inputs/selects: consistent `rounded-xl`
  - Buttons: consistent `rounded-xl`
- Use one table system:
  - header style
  - row height
  - hover state
  - skeleton row
  - empty state
  - pagination footer
  - status badges
- Use one modal system:
  - header
  - body scroll behavior
  - footer actions
  - cancel button
  - escape/overlay behavior
  - destructive action styling
- Use one status color system:
  - AI: blue or emerald, pick one and document it
  - Health: rose
  - Pregnancy: amber or violet, pick one and document it
  - Calving/Newborn: emerald or teal, pick one and document it
  - Emergency: red
  - Pending: amber
  - Completed: emerald
  - Cancelled/Rejected: slate or rose depending severity

### Priority UI Pages

1. Admin Dashboard
2. Technician Dashboard
3. Technician Requests
4. Admin Requests Monitor
5. Technician Breeding Ledger
6. Technician Reports
7. Admin Users
8. Admin Livestock
9. Admin Monitoring
10. Technician Schedule

### Acceptance Criteria

- The app uses consistent buttons, dropdowns, cards, tables, forms, and modals.
- Light and dark modes both pass readability checks.
- The admin dashboard hierarchy is clearer.
- The technician dashboard prioritizes queue, schedule, and quick actions.
- Tables look like the same system across modules.
- No important text wraps awkwardly in buttons or badges.

### Antigravity Prompt

```text
Read docs/web-production-cleanup-phases.md.
Use design-taste-frontend before making UI changes.

Implement Phase 4 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\web

Design read:
Internal municipal operations dashboards for admin and technician users, trust-first agricultural field-service language, calm dense product UI, preserved BreedSmart branding.

Taste-skill dials:
DESIGN_VARIANCE: 4
MOTION_INTENSITY: 2
VISUAL_DENSITY: 7

Rules:
- Do not redesign as a landing page.
- Do not change route URLs.
- Do not change primary navigation labels without approval.
- Do not change form field names or order unless required by a bug.
- Preserve logo, green accent, Outfit typography, and light/dark mode.
- Use taste-skill Section 11 audit first and write it in your response before editing.

Tasks:
1. Create a small web UI standard for cards, tables, buttons, inputs, selects, badges, modals, loading, empty, and error states.
2. Refactor shared components first:
   - src/components/ui/Topbar.jsx
   - src/components/ui/Sidebar.jsx
   - src/components/Skeleton.jsx
   - src/components/ui/Modal.jsx
3. Apply the standard to:
   - src/pages/admin/Dashboard.jsx
   - src/pages/technician/DashboardTechnician.jsx
   - src/pages/technician/Requests.jsx
   - src/pages/admin/Users.jsx
   - src/pages/admin/Livestock.jsx
   - src/pages/admin/Monitoring.jsx
4. Fix inconsistent dropdown colors, table headers, button radii, status badges, and spacing.
5. Ensure dark mode stays readable.
6. Run npm run lint, npm run test, and npm run build.

Stop after Phase 4.
```

## Phase 5: Forms, Modals, And Action Feedback

### Goal

Make every action predictable, validated, and recoverable.

### Tasks

- Audit every form:
  - Add required field indicators.
  - Add inline validation where practical.
  - Keep toast for submit result, not field-level validation only.
  - Disable submit while pending.
  - Prevent duplicate submit.
  - Preserve user input after failed submit.
- Audit every modal:
  - Has close/cancel action.
  - Has escape/overlay behavior.
  - Has fixed footer for long forms where useful.
  - Has loading/disabled state.
- Audit destructive actions:
  - Delete
  - Cancel
  - Reject
  - Restore
  - Clear notifications
  - Permanent field-note removal
- Replace browser `alert` and `window.confirm` with app modals/toasts.

### Priority Files

- `src/components/modals/WalkInAIModal.jsx`
- `src/components/modals/WalkInHealthModal.jsx`
- `src/components/modals/PregnancyDiagnosisModal.jsx`
- `src/components/modals/RecordCalvingModal.jsx`
- `src/components/modals/RegisterFarmerModal.jsx`
- `src/components/modals/RegisterLivestockModal.jsx`
- `src/components/modals/TaskActionModal.jsx`
- `src/pages/technician/Settings.jsx`
- `src/pages/technician/Moowie.jsx`
- `src/pages/admin/ArchivedRecords.jsx`

### Acceptance Criteria

- No visible button silently does nothing.
- Submit buttons show loading.
- Destructive actions ask for confirmation.
- Restore actions show success/error feedback.
- Browser alerts/confirms are removed from production flows.

### Antigravity Prompt

```text
Read docs/web-production-cleanup-phases.md.

Implement Phase 5 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\web

Goal:
Standardize forms, modals, confirmations, and action feedback.

Rules:
- Do not redesign page layouts broadly.
- Keep form field names and order unless a validation bug requires change.
- Replace browser alert/confirm with app modal/toast patterns.
- Preserve existing API behavior unless a bug is found.

Tasks:
1. Audit all listed modal/form files.
2. Add missing loading, disabled, validation, success, and error states.
3. Add confirmation modals to destructive actions.
4. Ensure restore/cancel/reject/delete wording matches backend behavior.
5. Run npm run lint, npm run test, and npm run build.

Stop after Phase 5.
```

## Phase 6: Reports, Exports, And PDF Safety

### Goal

Make reports reliable, role-safe, and easy to navigate.

### Tasks

- Centralize report/export helpers where possible.
- Ensure report filters are applied consistently.
- Ensure export buttons are disabled when there is no data.
- Escape or sanitize any dynamic HTML if HTML-based PDF generation is used.
- Make report names user-friendly:
  - Breeding Accomplishment
  - Health Assistance Summary
  - Farmer Activity
  - Livestock Registry
  - Barangay Summary
- Add clear empty states for no report data.
- Keep PDF and CSV output consistent between admin and technician where appropriate.

### Priority Files

- `src/pages/admin/Reports.jsx`
- `src/pages/technician/Reports.jsx`
- `src/pages/technician/BreedingLedger.jsx`
- `src/pages/technician/Health.jsx`
- export helpers inside those files

### Acceptance Criteria

- Reports do not require loading all records when backend filters are available.
- Report preview or summary is clear before export.
- PDF/CSV output uses the same filters shown in the UI.
- Failed export shows error toast.
- Empty export is blocked with helpful message.

### Antigravity Prompt

```text
Read docs/web-production-cleanup-phases.md.

Implement Phase 6 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\web

Goal:
Clean reports and exports for admin and technician modules.

Tasks:
1. Audit admin and technician report pages.
2. Centralize repeated export/PDF helpers where safe.
3. Ensure filters used in UI match filters used in exported files.
4. Add empty/error/loading states.
5. Disable export when no data exists.
6. Sanitize dynamic output if HTML report generation is used.
7. Run npm run lint, npm run test, and npm run build.

Stop after Phase 6.
```

## Phase 7: Tests And Production Hardening

### Goal

Build enough automated confidence for production deployment.

### Required Test Areas

- Route guards:
  - admin only
  - technician/veterinarian access
  - unauthorized redirect
- Request workflows:
  - accept AI
  - decline AI
  - triage health
  - resolve health
  - admin assignment
- Dashboard error states:
  - full success
  - partial failure
  - retry
- Archive/restore:
  - restore user
  - restore animal
  - error handling
- Tables:
  - pagination
  - search
  - filters
  - empty states
- Forms:
  - required validation
  - duplicate submit prevention
  - success/error toast

### Production Hardening Tasks

- Add app-level error boundary.
- Add real 404 page.
- Add network failure state.
- Add deployment health check display or hidden diagnostics page.
- Confirm no `.env` secrets are committed.
- Confirm API base URL is correct for deployment.
- Confirm Clerk roles are documented.
- Confirm backend authorization is tested, not only frontend guards.

### Acceptance Criteria

- Web test suite covers critical admin and technician workflows.
- Error boundary catches render failures.
- Unknown routes do not silently redirect in a confusing way.
- Production build passes.
- Known limitations are documented.

### Antigravity Prompt

```text
Read docs/web-production-cleanup-phases.md.

Implement Phase 7 only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\web

Goal:
Add production hardening and critical test coverage.

Tasks:
1. Add or improve tests for route guards, request workflows, dashboard error states, archive restore, tables, and forms.
2. Add an app-level error boundary.
3. Add a real 404/not-found page.
4. Add network failure UI where appropriate.
5. Confirm environment and deployment assumptions.
6. Run npm run lint, npm run test, and npm run build.

Stop after Phase 7.
```

## Phase 8: Final Release Review

### Goal

Confirm the web application is ready for controlled production or pilot deployment.

### Final Checklist

- Lint passes.
- Tests pass.
- Production build passes.
- Admin login works.
- Technician login works.
- Unauthorized access redirects correctly.
- Admin dashboard shows real metrics and partial failures.
- Technician dashboard shows queue, schedule, and quick actions.
- Request board handles AI and health assistance correctly.
- Admin can monitor/assign requests if supported.
- Tables are paginated.
- Large datasets are not loaded all at once.
- Reports export correctly.
- Archive/restore works.
- Notifications work.
- Light/dark mode is readable.
- Tablet/desktop responsive layout works.
- Mobile web layout is not broken even if not primary.
- No known public test route is exposed.
- No secrets in repo.
- Known limitations are documented.

### Acceptance Criteria

- Ready for internal stakeholder testing when Phase 8 passes.
- Ready for production only after backend authorization and deployment environment are also verified.

### Antigravity Prompt

```text
Read docs/web-production-cleanup-phases.md.

Implement Phase 8 final review only.

Target folder:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System\web

Goal:
Perform final release verification, not feature development.

Tasks:
1. Run lint, tests, and production build.
2. Manually smoke test admin and technician routes.
3. Verify request workflows.
4. Verify dashboard partial failure behavior.
5. Verify tables, reports, archive/restore, and notifications.
6. Verify responsive layouts.
7. Document remaining known limitations.

Do not start new features during Phase 8.
```

## Recommended Implementation Order

1. Phase 0: Safety Baseline And Verification
2. Phase 1: Critical Workflow Correctness
3. Phase 2: Dashboard Reliability And Partial Error States
4. Phase 3: Backend Pagination And Data Contracts
5. Phase 4: Web Design System And Taste-Skill UI Pass
6. Phase 5: Forms, Modals, And Action Feedback
7. Phase 6: Reports, Exports, And PDF Safety
8. Phase 7: Tests And Production Hardening
9. Phase 8: Final Release Review

Reason:

- Workflow correctness comes before visual polish.
- Dashboards must stop hiding backend failures before they are trusted.
- Pagination must be solved before production data grows.
- UI cleanup is more effective after data and workflows stabilize.
- Tests and final hardening should lock in the corrected behavior.

## Current Known Risks

- Admin dashboard can hide partial backend failures.
- Technician request completion may call incorrect endpoint for AI request records.
- Admin request monitor currently reuses technician request screen.
- Many older pages still fetch large lists and paginate/filter in the browser.
- Very large page files are hard to maintain safely.
- Test coverage is too thin for production confidence.
- UI is usable but inconsistent across modules.
- Some pages still use browser alert/confirm.
- Build passes, but PDF/map/chart vendor chunks are heavy.

## Definition Of Done For Web Pilot

The web app can be considered ready for controlled pilot testing when:

- Phase 1 workflow bugs are fixed.
- Dashboard failures are visible instead of silently converted to zeros.
- Request board works for technician and admin use cases.
- Large list pages no longer rely on `limit=1000`.
- Admin and technician core tables have loading, empty, error, pagination, and retry states.
- Forms and modals have clear validation and feedback.
- Lint, tests, and build pass.
- Known limitations are documented.

