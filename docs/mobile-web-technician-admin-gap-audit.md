# BreedSmart Mobile vs Web Gap Audit

Date: 2026-06-30

Scope: technician and admin mobile flows in `mobile_2.0` compared with the current web dashboard in `web`.

## Summary

The web dashboard already has many matching areas: technician dashboard, requests, animals, farmer directory, health, field notes, reports, schedule, route optimizer, admin monitoring, barangay insights, support tickets, audit logs, archived records, users, livestock, technicians, and reports.

The main gaps are not basic pages. The gaps are workflow depth, mobile-specific field flows, source-aware queue behavior, offline/sync UI, and newer breeding verification logic.

## Technician Mobile Logic Not Fully Reflected On Web

### 1. Source-aware Pregnancy Check Queue

Mobile/backend now separates pregnancy check tasks by source:

- `automatic_pd_followup`
- `farmer_requested_verification`
- `manual`

Mobile technician cards label these differently:

- Scheduled Pregnancy Follow-up
- Farmer Requested Pregnancy Verification
- Pregnancy Check

Web should verify this same distinction in technician request/task views. Automatic future PD follow-ups should not look like immediate work unless due/overdue or explicitly shown as upcoming.

Recommended web work:

- Add source labels in technician requests/tasks.
- Show due date clearly for automatic PD follow-ups.
- Add an `includeUpcoming` or Upcoming Follow-ups view.
- Avoid mixing future scheduled PD tasks into the urgent/current queue.

### 2. Dedicated Pregnancy Verification Flow

Mobile has a dedicated technician route:

- `mobile_2.0/app/(technician)/pregnancy-verification.tsx`

It supports technician verification of farmer breeding observations with:

- animal and farmer context
- farmer observation signs and notes
- cattleCore milestones
- verification outcome
- check method
- checked date
- next check date for recheck

Web has a `PregnancyDiagnosisModal`, but it should be checked against the newer mobile flow.

Recommended web work:

- Add or update web pregnancy verification UI to support farmer-submitted observation context.
- Include source record details from PD task/insemination.
- Support `needs_recheck` and follow-up scheduling.
- Match backend endpoint `POST /api/ai-request/:id/verify-breeding-observation`.

### 3. Request Cancellation Review Flow

Mobile request cards show cancellation review states:

- `cancellationStatus === "requested"`
- red Cancel Requested badge
- Review Cancellation Request action

Mobile request details support:

- approve cancellation
- reject cancellation with notes
- reschedule instead of cancelling

Web has cancellation-related modals, but should be checked for parity in technician request screens and task action modals.

Recommended web work:

- Show pending cancellation badges in technician request tables/cards.
- Prevent normal start/complete actions while cancellation review is pending.
- Add approve/reject/reschedule workflow in request details.

### 4. Early Completion Warning

Mobile warns technicians if they complete or resolve a service more than 2 hours before the scheduled date/time.

Recommended web work:

- Add the same soft confirmation before completing AI or resolving health assistance early.
- Message should include the scheduled date/time.

### 5. Offline Queue And Sync History

Mobile has offline-first logic and technician screens related to:

- sync history
- offline queue
- failed sync visibility
- startup/reconnection queue processing
- offline maps

Web likely does not need full offline parity, but should still show operational state clearly.

Recommended web work:

- Add a lightweight connection/status banner for socket/API failures.
- Add retry affordances on failed mutations.
- Avoid silent success toasts after failed API calls.
- Do not copy mobile offline queue wholesale unless web offline mode becomes a requirement.

### 6. Technician Animal Hub Pagination And Filters

Mobile has a technician animal hub with:

- search
- filters
- pagination
- animal cards
- empty state

Web has technician animals, but should be checked for:

- page size limits
- server-side search/filtering
- no `limit=1000` style fetching
- consistent empty/loading/error states

Recommended web work:

- Use paginated APIs for animal lists.
- Keep filters consistent with mobile: status, breed/species, barangay, health/reproductive state.

### 7. Technician Clients/Farmer Directory Pagination

Mobile has a modular technician clients flow:

- `technician-clients`
- search
- barangay filter
- pagination
- client cards

Web has `FarmersDirectory` and `FarmerProfile`, but should be checked for equivalent pagination and state handling.

Recommended web work:

- Confirm web directory does not fetch all farmers at once.
- Add consistent loading, empty, error, retry, and pagination UI.

### 8. Technician Records Ledger Export UX

Mobile technician records include:

- record filters
- date range selector
- ledger detail modal
- export action sheet
- ledger export utilities

Web has reports and breeding ledger pages, but may not match mobile’s focused field-record export flow.

Recommended web work:

- Compare mobile technician records filters against web reports/breeding ledger.
- Add missing date range, record type, status, farmer, animal, and barangay filters.
- Centralize export actions and make results role-scoped.

### 9. Photo Notes / Field Notes Flow

Mobile includes:

- `photo-notes`
- field note creation
- technician field note list
- animal/farmer context

Web has `FieldNotes` and `UploadNoteModal`, but should be checked for parity.

Recommended web work:

- Confirm photo attachments and note context are displayed in animal history.
- Add loading/error/retry states.
- Ensure notes are role-scoped and auditable.

### 10. Mobile Technician Dashboard Sections

Mobile technician dashboard is componentized around:

- hero header
- stats
- priority requests
- route section
- quick actions
- performance card
- farmer standings
- Moowie help card
- skeleton states

Web dashboard exists, but should be compared for workflow order.

Recommended web work:

- Put priority work first: urgent health, today AI, pregnancy checks due, calving due, follow-ups.
- Put metrics second.
- Add skeleton states instead of generic spinners.
- Keep Moowie as support/assistant, not a primary dashboard blocker.

## Admin Mobile Logic Not Fully Reflected On Web

### 1. Admin Mobile Dashboard Cards

Mobile admin dashboard includes specialized cards/components:

- Municipality Overview
- System Health Card
- Registry Health Card
- Backup Monitor Panel
- Alerts Panel
- Activity Timeline
- Technician Performance
- Moowie Insights Card
- Analytics Grid

Web has admin monitoring/dashboard pages, but should be checked for equivalent information density and actionability.

Recommended web work:

- Map each mobile card to a web dashboard section.
- Avoid duplicating stats across dashboard and monitoring.
- Add clear drill-down links from alerts to records/users/tasks.

### 2. Barangay Insights And Barangay Detail

Mobile has:

- Barangay Insights screen
- Barangay Details screen
- services/hooks for insights and details

Web has `BarangayInsights`, but should be checked for parity with the mobile detail workflow.

Recommended web work:

- Add barangay-level drill-downs for farmers, animals, AI, health, pregnancy, calving, and workload.
- Include unresolved/urgent counts and trend context.

### 3. Admin Records Export

Mobile admin records include:

- admin records screen
- date range selector
- records export utility
- summary cards

Web reports likely cover this partially.

Recommended web work:

- Confirm web reports include the same role-safe filters and export types.
- Add health, AI, pregnancy, calving, offspring, farmer, technician activity, and barangay reports.
- Avoid generating reports from unescaped dynamic HTML.

### 4. Admin User Detail And Create User Flow

Mobile has:

- Admin Users screen
- User Detail screen
- Create User screen
- hooks/services for user management

Web has Users and Technicians pages, but should be checked for:

- soft delete/restoration
- suspended users
- role/status changes through admin-only endpoints
- audit visibility

Recommended web work:

- Ensure user status changes are not generic profile edits.
- Add restore/suspend workflows where missing.
- Surface audit history for important user actions.

### 5. Admin Animal Registry Health

Mobile admin animal features include:

- registry health summary
- admin animal screen
- animal services/hooks

Web livestock pages exist, but should be checked for registry-quality indicators.

Recommended web work:

- Show missing owner, missing animal ID, duplicate ear tag, missing birth date, missing sex/species, and inconsistent reproductive status.
- Provide admin cleanup/review workflow without hard-deleting clinical or breeding history.

## Shared UI/Flow Gaps To Bring From Mobile To Web

### 1. Consistent Async States

Mobile has shared loading/empty/error patterns in several newer features.

Web should standardize:

- skeleton loading
- empty state
- error state
- retry action
- stale data message
- disabled submit state

### 2. Pagination By Default

Mobile has started adding pagination in animal/client/request hubs.

Web should avoid large unbounded list loads.

Priority lists:

- technician animals
- farmer directory
- admin users
- admin livestock
- reports/records
- animal history/timeline
- health requests
- AI requests

### 3. Source Labels And Status Badges

Mobile uses more specific labels for:

- health urgency
- request status
- cancellation status
- pregnancy check source
- sync state

Web should use the same semantic status vocabulary.

### 4. Farmer/Animal Context Cards

Mobile field workflows repeatedly show farmer and animal context before actions.

Web modals should also show:

- farmer name and barangay
- contact number
- animal ID/ear tag
- species/breed/sex
- current reproductive/health status
- linked source record

### 5. CattleCore Milestones

Mobile pregnancy-related screens use cattleCore milestone estimates.

Web should use the same cattleCore source for:

- heat return window
- ultrasound window
- palpation/manual PD window
- expected calving
- postpartum recovery

Avoid duplicating date formulas inside web components.

## Recommended Web Parity Priority

### P0

- Source-aware PD queue labels and filtering.
- Pregnancy verification flow parity.
- Cancellation review parity.
- Pagination for technician/admin large lists.
- Consistent loading/error/empty states.

### P1

- Admin registry health and barangay drill-down parity.
- Technician records ledger/export parity.
- Animal profile timeline/history parity.
- Early completion warning in web technician workflows.

### P2

- Moowie role-specific action cards on web.
- Web connection/retry banner.
- Advanced route planning parity with mobile map/offline-map concepts.

## Implementation Notes For Later

- Do not copy mobile UI literally into web. Port the workflow logic and status vocabulary.
- Keep technician as the current combined role for AI, pregnancy, calving, and health assistance.
- Keep veterinarian role future-ready in backend, but do not create a separate dashboard for this release.
- Prefer shared API services/hooks in web instead of direct API calls inside page components.
- Preserve the current web dashboard structure; add missing workflow depth incrementally.

PROMPT

Read and follow `docs/mobile-web-technician-admin-gap-audit.md`.

Important:
The mobile reference is `mobile_2.0`, not the original `mobile` folder.

Goal:
Improve the `web` dashboard parity with the technician/admin flows already implemented in `mobile_2.0`.

Rules:

- Use `mobile_2.0` as the mobile source of truth.
- Do not use or modify the original `mobile` folder.
- Work mainly in `web`.
- Only touch `backend_2.0` if a required API is missing or mismatched.
- Do not modify the original `backend` folder.
- Preserve the current web layout and BreedSmart identity.
- Do not redesign the dashboard from scratch.
- Implement incrementally, starting with P0.
- Prefer services/hooks instead of direct API calls inside large page components.
- Add loading, empty, error, retry, and disabled states where missing.

Start with P0:

1. Source-aware PD queue labels and filtering based on `mobile_2.0`.
2. Pregnancy verification web parity based on `mobile_2.0/app/(technician)/pregnancy-verification.tsx`.
3. Cancellation review parity based on `mobile_2.0/app/(technician)/request-details.tsx` and technician request cards.
4. Pagination for large technician/admin lists.
5. Consistent loading/error/empty states.

After changes, run:

- `npm run lint`
- `npm run test`
- `npm run build`

Report:

- Files changed
- Which `mobile_2.0` flows were used as reference
- Features completed
- Remaining gaps
- Any backend_2.0 API mismatch found
