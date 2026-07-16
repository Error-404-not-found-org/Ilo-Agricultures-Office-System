# Web Technician DaisyUI Audit and Redesign Plan

Last updated: July 15, 2026

## Scope and evidence

This plan covers the Web Technician experience only. Shared layout, theme, API, and workflow code may be changed when required for compatibility, but Admin and Farmer page redesigns are out of scope.

The audit used repository source, route definitions, API calls, shared components, backend contracts, the Mobile Technician implementation, and an authenticated browser session. The existing web lint, Vitest suite, and production build all passed before implementation began. Live visual QA is now active against the local Technician portal in both the normal browser width and an explicit 390 px responsive viewport.

## Implementation status

Completed or substantially implemented:

- BreedSmart semantic DaisyUI light/dark themes, plus optional Black and Dracula themes.
- Theme persistence, pre-paint initialization, shared toaster theme support, and theme tests.
- Active shared drawer/sidebar/topbar conversion and native shared dialog foundation.
- Canonical Technician request claim/decline behavior and dedicated breeding-observation verification.
- Request filter parity, workflow validation, responsive request cards, retry/empty/loading states, and clearer labels.
- Dashboard terminology, quick actions, background refreshing, and semantic surfaces.
- Farmer and Animal directories are implemented and authenticated-browser verified:
  - both use compact desktop tables and responsive cards below the desktop breakpoint;
  - municipality, Iloilo City district, and dependent barangay filters share the same address vocabulary;
  - Farmer app-access states distinguish connected, no app account, profile-only, and blocked records;
  - Animal species now uses the real backend vocabulary and groups cattle safely;
  - all canonical reproductive statuses are available, sex filtering is processed by the backend, and location filtering uses the farmer address;
  - legacy location placeholders such as `N/A` are removed from display;
  - summary labels state whether counts represent filtered results or the current page.
- AI Service Records responsive redesign and backend query contract repair:
  - search and estrus/outcome filters are now processed by the backend;
  - all backend estrus and outcome values are represented;
  - summary totals are no longer calculated from only the current page;
  - technician and linked previous-attempt data are returned;
  - narrow widths use readable cards instead of a nested scrolling table;
  - record details explain the attempt, verification state, notes, and linked history.
- Farmer Profile workspace redesign:
  - replaces the former system-style presentation with clear farmer identity, app-access, verification, contact, herd-summary, and quick-action sections;
  - corrects cattle totals by recognizing the backend cattle vocabulary rather than only the literal `Cattle` value;
  - removes legacy `N/A` address fragments and presents a usable Iloilo location;
  - exposes every canonical reproductive-status filter and responsive animal cards/table views;
  - uses skeleton, retry, empty, and no-results states while preserving registration and walk-in AI actions.
- Animal Profile foundation shared with Admin:
  - introduces semantic DaisyUI surfaces, workflow badges, skeleton/error states, and cleaned owner location;
  - keeps Overview, Animal Records, Breeding ledger, Medical records, and Technical bio reachable at narrow widths;
  - replaces the inert export control with a working CSV export of the profile and combined history;
  - preserves role-aware Technician and Admin routes and existing clinical workflow actions.
- Health Assistance workspace redesign and data-contract repair:
  - backend pagination responses now include filtered total, high/emergency, resolved, and active summary counts instead of forcing the Web to summarize only the current page;
  - removes the hardcoded `Oton` fallback and displays the populated farmer address or an honest `Location not recorded` state;
  - aligns urgency filters with `low`, `medium`, `high`, and `emergency`, and exposes every canonical health workflow status;
  - replaces fixed light/dark colors with semantic DaisyUI surfaces and badges;
  - uses responsive health-case cards on narrow widths and keeps the detailed table on desktop;
  - simplifies clinical terminology and adds farmer location, request type, assessment, treatment, and notes to the case detail view.
- Overview, Quick Actions, and lifecycle workspace follow-up:
  - Overview now uses real monthly AI, health, pregnancy, and calving aggregates; removed placeholder chart values and corrected active-request and today-work definitions;
  - Today’s Visits uses the real farmer/animal/location/service mapping and canonical workflow badges;
  - Quick Actions now match the six Mobile Technician workflows and use plain labels; AI and Health actions select existing farmer/animal records while registration remains in the dedicated Register Farmer and Register Animal actions;
  - Health Assistance supports direct record entry, emergency urgency, medicine/dosage, follow-up date, and withdrawal-period capture, and prevents active cases from being deleted through the list UI;
  - Breeding Ledger now distinguishes all records, completed AI, confirmed pregnancies, calvings, and active AI requests instead of counting every request as a completed insemination;
  - AI, Pregnancy, and Calving tabs each expose their matching record action, display cleaned farmer locations, and use the same user-facing vocabulary as Mobile;
  - re-insemination details display the linked previous attempt date/outcome when populated and clearly identify legacy attempt-number records whose `previousAttemptId` is missing.

Latest automated verification after the profile and Health Assistance implementation:

- Web lint: passed.
- Web Vitest: 7 files and 21 tests passed.
- Web production build: passed.
- Backend Technician and Health controller syntax validation: passed.
- Backend regression suite: 108 tests passed.

Authenticated visual finding resolved: at 686 px the old AI log rendered a desktop table with nested horizontal and vertical scrollbars. The redesigned page has no document-level horizontal overflow and switches to record cards. A 390 px validation found one small card-action crowding issue; the responsive header/action adjustment has been applied and remains part of the next final browser regression pass.

Authenticated directory verification:

- Animals sex filter was exercised live, returned an empty result for the current male query, and restored all 10 records without an API error.
- Farmers app-access filter was exercised live, reduced the current page from 10 profiles to 6 connected profiles, and restored correctly.
- Farmers and Animals both reported no document-level horizontal overflow at a 390 px viewport.
- Web lint, all 21 tests, and the production build passed after this directory group.

Authenticated profile verification:

- Farmer Profile displayed the correct 2 registered animals, 2 cattle, cleaned `Iloilo City` location, and active registration/walk-in actions for the inspected farmer.
- Animal Profile displayed the cleaned owner location and all five history tabs without document-level horizontal overflow.
- Both profile workspaces were checked at a 390 × 844 viewport with no horizontal overflow.
- Health Assistance was verified with live authenticated data at 390 × 844: two case cards rendered without horizontal overflow, emergency/scheduled and low/cancelled states mapped correctly, the full urgency/status filters were present, and case details included the populated farmer location.

Authenticated Overview and lifecycle verification:

- Overview displayed real scheduled/ready/completed work, active AI/health request counts, monthly service totals, cleaned visit locations, and all six Mobile-aligned Quick Actions.
- The AI Quick Action was inspected live and no longer exposes the unrelated full-registration branch; its sections are Farmer and animal plus Service details.
- Breeding Ledger displayed 5 total records, 0 completed AI, and 3 active AI requests for the current development data, correcting the former misleading 5 “Inseminations Done” count.
- The current legacy Attempt #2 record was inspected and has no populated `previousAttemptId`; the UI now surfaces that migration/data-integrity gap rather than inventing a prior attempt.

## Phase 1: audit

### Technician route inventory

| Area | Route | Current page/ownership |
| --- | --- | --- |
| Overview | `/technician/dashboard` | Technician dashboard |
| Requests | `/technician/requests` | Shared with Admin requests route |
| Farmers | `/technician/farmers`, `/technician/farmers/:id` | Directory and farmer profile |
| Animals | `/technician/animals`, `/technician/animals/:id` | Directory; detail reuses Admin livestock profile |
| AI records | `/technician/inseminations` | AI services list |
| Breeding | `/technician/ledger` | Breeding, pregnancy, and lifecycle ledger |
| Calving | `/technician/newborns` | Shared newborn records page |
| Health | `/technician/health`, `/technician/health-map` | Health records and map |
| Manual entry | `/technician/walk-in` | Walk-in AI entry |
| Field work | `/technician/schedule`, `/technician/field-notes` | Schedule and notes/photos |
| Reporting | `/technician/analytics`, `/technician/reports` | Performance and exports |
| Support | `/technician/moowie`, `/technician/profile`, `/technician/settings` | Assistant, profile, settings |

### Current DaisyUI and design-system state

- DaisyUI 5.5.20 and Tailwind CSS 4 are installed and the web production build recognizes DaisyUI.
- The app currently enables built-in `emerald` and `night` themes, but most active components use fixed slate, white, emerald, blue, and rose classes plus a parallel `.dark` class strategy.
- Some shared controls use DaisyUI classes (`btn`, `select`, `table`), while other inputs, cards, modals, navigation, pagination, alerts, and badges recreate the same primitives with custom Tailwind.
- The active layout is `web/src/components/ui/Layout.jsx`. A second older `web/src/components/Layout.jsx` contains a different DaisyUI drawer/navigation implementation. This duplicate ownership is a maintenance risk and must not be swapped in blindly.
- Status presentation exists in multiple places: `uiClasses.js`, `ui/Badge.jsx`, Requests, Dashboard, Breeding Ledger, and workflow modals. Labels and colors can drift.
- Several technician pages and modals are very large files, which combines API mapping, workflow rules, validation, and presentation in one component.

### Dark-mode findings

1. Built-in DaisyUI themes do not encode the exact BreedSmart palette.
2. Semantic DaisyUI colors and hardcoded `dark:` variants compete, producing inconsistent surfaces and contrast.
3. Theme persistence exists in `index.html`, which prevents most initial flash, but the theme names and theme toggle remain coupled to `emerald`/`night` instead of application-owned semantic themes.
4. Topbar, notification dropdowns, sidebar, shared modals, tables, badges, charts, maps, skeletons, and page-local cards each implement dark mode separately.
5. The sidebar stays a fixed dark slate surface in both modes, making the theme behavior feel partially applied.

### Accessibility findings

- The shared modal is a positioned `div`, not a native dialog, and does not trap or restore focus.
- Several action buttons rely on color and icon alone; status/action labels need accessible text and consistent disabled/busy states.
- Very small 9–11 px uppercase labels are common and reduce readability.
- Table-row click targets contain nested actions without a consistent keyboard interaction model.
- The notification dropdown and collapsible navigation need explicit expanded/control relationships.
- Forms need consistent visible labels, descriptions, error text, required markers, and focus styling.

### Responsive findings

- The active sidebar uses a custom off-canvas implementation rather than DaisyUI drawer structure.
- Dense request and record tables do not consistently provide a readable card representation at narrow widths.
- Page-level action groups and filters can overflow or compress important controls.
- Large custom modals need standardized viewport height, sticky actions, and responsive widths.

### UX-state findings

- Skeletons exist but are not consistently used for initial loading and details.
- Empty, no-search-result, permission, and network-error states are page-specific or absent.
- Background refetching is not consistently distinguished from initial loading.
- Some actions use duplicate or overly technical toasts. Buttons are not always protected from repeated submission by a request-scoped pending state.

## Web versus Mobile Technician logic comparison

| Workflow | Mobile reference | Current Web finding | Required action |
| --- | --- | --- | --- |
| Request list | Type, status, urgency, assignment, Near Me, municipality, barangay, search, sort, pagination | Web mainly exposes status and search | Add supported filters without changing API fields |
| Claim request | `PATCH /technician/requests/:type/:id/claim` | Web Accept directly changes status | **Critical:** use canonical claim endpoint to prevent competing assignment |
| Decline for technician | Technician-specific decline/hide behavior | Web generic cancel/reject can alter the whole request | Align technician decline with Mobile; retain explicit cancellation only where authorized |
| AI status | `PATCH /ai-request/:id/status` | Canonical endpoint is used | Preserve; centralize allowed transitions and payload validation |
| Health status | Triage then canonical status resolution | Web uses triage/status but generic modal transitions are incomplete | Align transition labels and required diagnosis/treatment/advice fields |
| Breeding observation verification | `POST /ai-request/:id/verify-breeding-observation` with verification outcomes | Web opens the generic pregnancy-diagnosis modal | **Critical:** create a dedicated verification action and endpoint mapping |
| Pregnancy diagnosis | `POST /technician/pregnancy-check` | Canonical endpoint is used | Preserve and distinguish from observation verification |
| Calving | `POST /technician/record-calving` | Canonical endpoint is used | Preserve validation and lifecycle refresh behavior |
| Re-insemination | First attempt must be verified failed; new request is linked and numbered by backend | Web displays some attempt context, but must not generate attempts in UI | Show lineage and eligibility; submit only canonical request/action; never calculate attempt number client-side |
| Farmers/animals | Searchable records, role-aware detail/history | Web pages exist | Standardize summary, history, loading, empty, and error states |
| Offline | Mobile queues supported mutations | Browser app has no equivalent queue | Do not imitate mobile offline queue; show clear network failures and safe retry |

## Confirmed functional risks

1. Web request acceptance bypasses the canonical claim endpoint and can undermine assignment safety.
2. Web breeding verification currently enters the official pregnancy-diagnosis path; these are different clinical/business events.
3. Pending/approved items are advanced directly to `in-progress` in the generic modal, which can skip the Mobile scheduling/assignment sequence.
4. Request filters and assignment visibility are below Mobile parity, making it harder to find actionable field work.
5. Multiple local status maps create a risk that UI actions are shown for invalid transitions even when the backend rejects them.

Backend schemas and transition services should remain unchanged unless a route-level test proves an API contract is missing.

## Phase 2: page-by-page redesign plan

### 1. Technician layout and navigation

- Problem: custom off-canvas navigation, hardcoded dark sidebar, duplicated navigation/layout ownership.
- DaisyUI: `drawer`, `drawer-side`, `drawer-content`, `menu`, `collapse`, `badge`, `navbar`, `dropdown`, `theme-controller`.
- Reusable work: central Technician navigation configuration and role-aware layout slots.
- Preserve: route names, permissions, unread counts, inactivity sign-out, Admin compatibility.
- Responsive: persistent sidebar on large screens; overlay drawer on tablet/narrow widths; keyboard-operable close behavior.
- Files: active Layout, Sidebar, Topbar, ThemeToggle, theme stylesheet, index theme initializer.

### 2. Shared theme and UI foundations

- Problem: competing DaisyUI and hardcoded color systems.
- DaisyUI: application-owned light/dark themes using semantic tokens; `btn`, `input`, `select`, `textarea`, `badge`, `alert`, `modal`, `skeleton`, `loading`, `pagination`.
- Reusable work: page header, workflow badge/config, async state, filter bar, form field/section, confirmation dialog, responsive data view.
- Preserve: Outfit typography and BreedSmart green palette.
- Files: `index.css`, `index.html`, shared UI components, new technician workflow configuration.

### 3. Dashboard

- Problem: inconsistent cards/status colors and densely mixed operational data.
- DaisyUI: `stats`, `card`, `badge`, `alert`, `skeleton`, responsive grid.
- Content: today’s visits, ready work, pending requests, follow-ups, and lifecycle alerts with explicit next actions.
- Preserve: existing dashboard endpoints and counts; verify count definitions against request statuses.

### 4. Requests queue

- Problem: incomplete filters, unsafe claim behavior, dense table actions, inconsistent assignment visibility.
- DaisyUI: filter controls, badges, responsive desktop table plus narrow-width cards, pagination, skeleton, alerts.
- Logic: canonical claim, technician decline, current assignment lock, request-scoped pending state, deep-link support.
- Mobile alignment: type/status/urgency/assignment/location/sort/search fields supported by the backend.

### 5. Request details and workflow actions

- Problem: generic modal combines different clinical workflows and can skip transitions.
- DaisyUI: native dialog, timeline/steps, form controls, alerts, sticky modal actions.
- Reusable work: request summary, farmer/animal summary, assignment panel, visit schedule, history, transition action panel.
- Logic: separate AI, health, breeding observation verification, pregnancy diagnosis, cancellation, and rescheduling actions.

### 6. Farmer and animal records

- Problem: tables/details use different patterns and narrow widths are difficult to scan.
- DaisyUI: search/filter bar, table/card responsive view, summary cards, tabs, skeleton, empty/error states.
- Logic: preserve backend records and ownership; expose animal history and related AI/health/lifecycle records.

### 7. AI, breeding, pregnancy, calving, and health

- Problem: large pages/modal duplication and inconsistent terminology.
- DaisyUI: tabs, cards, tables, badges, forms, timeline, alerts, modal, skeleton.
- Logic: canonical endpoints only; centralized status labels; explicit prerequisites; linked re-insemination attempts; no UI-generated attempt numbering.
- Files: AI services, Breeding Ledger, Health, Newborns, Walk-in pages, relevant workflow modals.

### 8. Schedule, map, notes, reports, analytics, profile, settings, assistant

- Standardize page headers, semantic surfaces, loading/empty/error states, action placement, responsive layout, and dark-mode tokens.
- Preserve specialized map/chart behavior and only adapt their palettes from the active semantic theme.

## Reusable component target

- `TechnicianPageHeader`
- `WorkflowBadge` backed by one workflow configuration
- `TechnicianFilterBar` and `SearchField`
- `AsyncState` for loading/error/empty/no-results
- `ResponsiveDataView` for table/card switching
- `RequestSummaryCard`
- `FarmerSummaryCard` and `AnimalSummaryCard`
- `WorkflowTimeline`
- `FormSection` and `FieldMessage`
- `ConfirmDialog` using a native DaisyUI modal
- `PaginationControls`

Components should wrap DaisyUI patterns only when the wrapper adds shared application behavior or configuration.

## Phase 3: implementation order

1. Define BreedSmart semantic DaisyUI themes and pre-paint initialization.
2. Centralize Technician navigation and workflow/status configuration.
3. Convert the active layout, sidebar, and topbar to semantic DaisyUI patterns while preserving Admin compatibility.
4. Add shared Technician UI states and workflow components.
5. Fix canonical claim and dedicated breeding-verification behavior before redesigning request actions.
6. Redesign Dashboard and Requests.
7. Redesign Farmer/Animal records and details.
8. Redesign AI, breeding, pregnancy, calving, and health workflows.
9. Standardize remaining Technician pages.
10. Remove only demonstrably unused duplicate layout/component code after reference checks.

## Phase 4: verification

After each implementation group:

- `npm run lint` in `web`
- `npm test -- --run` in `web`
- `npm run build` in `web`
- Relevant backend route-level tests when workflow calls change

Manual workflow checks:

1. Load light and dark mode directly on every Technician route; refresh and confirm no wrong-theme flash.
2. Open/close sidebar at desktop, tablet, and narrow widths; confirm focus and route navigation.
3. Claim the same pending request from two technician sessions; only one claim may succeed.
4. Confirm Technician decline does not globally cancel a farmer request unless the explicit cancel workflow is used.
5. Complete AI transitions with required service fields and confirm the animal history updates.
6. Verify a breeding observation through its dedicated workflow; confirm it does not create a pregnancy diagnosis accidentally.
7. Record a pregnancy diagnosis and calving through their canonical workflows.
8. Confirm a re-insemination request is allowed only after a verified failed prior attempt and shows linked attempt history.
9. Resolve a health request with required clinical details and verify the medical record appears once.
10. Exercise loading, empty, no-results, API error, permission error, slow mutation, and duplicate-click states.
11. Verify tables become readable cards or controlled scrollers at narrow widths.
12. Keyboard-test navigation, dialogs, form labels/errors, focus visibility, and action buttons.

## Completion definition

The redesign is complete only when all Technician routes use the semantic theme consistently, critical Web/Mobile workflow mismatches are resolved, relevant automated checks pass, and the manual checklist has been executed in an authenticated browser session. Authenticated manual QA remains an explicit release gate; it is now underway rather than blocked.

## July 15 usability consolidation pass

Completed in this pass:

- Renamed the Technician service workspace to **Request Board** and made **Available to claim** the default view for technicians.
- Renamed accepted-work sections to **My scheduled visits**, **In progress**, and **Completed**; removed the redundant assignment selector from the technician view while retaining it for Admin monitoring.
- Replaced technical request table headings with plain-language labels and added a claim-oriented empty state.
- Renamed **Schedule** to **Visit Calendar** and simplified calendar instructions, service filters, visit counts, empty states, and route-map wording.
- Removed duplicated AI Service and Calving tabs from the former **Breeding & Pregnancy** workspace. The workspace and sidebar entry now focus on **Pregnancy Checks**; AI Services and Calving Records remain their own destinations.
- Added desktop table skeletons to Farmer and Animal lists; the previous loading layout only rendered on narrow screens.
- Increased muted light-mode text contrast and secondary text size on Farmer and Animal records.
- Reduced the width, height, spacing, and visual density of all Dashboard Quick Action forms while improving field-label and placeholder readability.

Automated verification completed:

- Focused ESLint: passed.
- Web Vitest suite: 21 tests passed.
- Vite production build: passed.

Remaining release checks for this group:

- Confirm Request Board claim actions with at least one live unassigned AI and health request.
- Confirm Visit Calendar cards for AI, health, pregnancy-check, and calving tasks open their correct workflow forms.
- Keyboard-test all six Quick Action dialogs at desktop and narrow viewport sizes.
