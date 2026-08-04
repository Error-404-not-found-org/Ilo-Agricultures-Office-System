# BreedSmart Regression Workbook

## Assignment

- Owner: Gian Rovik Somes
- Purpose: verify fixes and protect neighboring workflows
- Release commit: `TBD by QA Lead`

## Defect retest procedure

For every fixed defect:

1. Pull and record the fix commit.
2. Reproduce the original steps using equivalent controlled data.
3. Confirm the original failure is gone.
4. Test one valid neighboring workflow.
5. Test one invalid/permission/retry case.
6. Attach new evidence.
7. Mark the bug `VERIFIED` only when all expected results pass.

## Critical regression suite

| Test ID | Regression check | Expected result | Status | Evidence or bug ID |
| --- | --- | --- | --- | --- |
| RG-AUTH-01 | Farmer/Technician/Admin role routing | Each role reaches only authorized surfaces | NOT RUN | |
| RG-AUTH-02 | Suspended user | Protected mutation is rejected | NOT RUN | |
| RG-REG-01 | Farmer and Animal registration | Records persist once and cross-platform mappings agree | NOT RUN | |
| RG-REG-02 | Duplicate ear tag | Duplicate is rejected without data mutation | NOT RUN | |
| RG-REQ-01 | Health submit → claim → schedule | Ownership, status, and date/time remain consistent | NOT RUN | |
| RG-REQ-02 | Health → Work Queue | Assigned operational Health work appears once | NOT RUN | |
| RG-REQ-03 | Health completion | Request resolves and one Medical Record exists | NOT RUN | |
| RG-AI-01 | AI submit → claim → schedule → complete | One linked Insemination and closed task/request | NOT RUN | |
| RG-AI-02 | Duplicate active AI request | Duplicate rejected; existing request unchanged | NOT RUN | |
| RG-AI-03 | AI retry/idempotency | No duplicate Insemination | NOT RUN | |
| RG-PD-01 | Early pregnancy diagnosis | Blocked with eligible-date guidance | NOT RUN | |
| RG-PD-02 | Official pregnancy diagnosis | One official record linked to correct AI attempt | NOT RUN | |
| RG-PD-03 | Duplicate diagnosis | Rejected and no stale overdue task remains | NOT RUN | |
| RG-PD-04 | Continuation/follow-up | Existing Pregnancy is updated, not duplicated | NOT RUN | |
| RG-REAI-01 | Re-insemination linkage | Attempt 2 links to verified failed Attempt 1 | NOT RUN | |
| RG-CALV-01 | Live birth | Mother, Pregnancy, Calving, and offspring reconcile once | NOT RUN | |
| RG-CALV-02 | Stillbirth/abortion/mixed | Outcome language, parity, and offspring counts are truthful | NOT RUN | |
| RG-CALV-03 | Calving retry/idempotency | No duplicate Calving or offspring | NOT RUN | |
| RG-POST-01 | Postpartum AI restriction | AI blocked until recovery policy allows it | NOT RUN | |
| RG-WQ-01 | Active Work Queue classification | Due, upcoming, on-hold, completed, and overdue are exclusive/correct | NOT RUN | |
| RG-SCH-01 | Schedule synchronization | Requests, Work Queue, Schedule, and Mobile agree | NOT RUN | |
| RG-SYNC-01 | Web mutation → Mobile refresh | Latest official record appears once | NOT RUN | |
| RG-SYNC-02 | Mobile mutation → Web refresh | React Query view updates without stale duplicate | NOT RUN | |
| RG-SEC-01 | Cross-Farmer ownership | Farmer cannot access another Farmer's Animal | NOT RUN | |
| RG-SEC-02 | Cross-Technician assignment | Technician cannot complete another Technician's work | NOT RUN | |
| RG-SEC-03 | Admin-only corrections | Non-admin is rejected | NOT RUN | |
| RG-UI-01 | Web light/dark readability | Critical text and controls pass visual review | NOT RUN | |
| RG-UI-02 | Narrow-screen Web | No page overflow; tables/modals remain usable | NOT RUN | |
| RG-UI-03 | Keyboard operation | Navigation, menus, forms, and dialogs are operable | NOT RUN | |
| RG-DATA-01 | User-facing data truth | No fabricated fallback values or internal identifiers | NOT RUN | |

## Automated release checks

| Area | Command | Result | Evidence |
| --- | --- | --- | --- |
| Backend syntax | `cd backend && npm run check` | NOT RUN | |
| Backend tests | `cd backend && npm test` | NOT RUN | |
| Mobile types | `cd mobile && npx tsc --noEmit` | NOT RUN | |
| Mobile lint | `cd mobile && npm run lint` | NOT RUN | |
| Web tests | `cd web && npm run test` | NOT RUN | |
| Web lint | `cd web && npm run lint` | NOT RUN | |
| Web build | `cd web && npm run build` | NOT RUN | |
| Diff hygiene | `git diff --check origin/main...HEAD` | NOT RUN | |
| Worktree | `git status --short` | NOT RUN | |

## Final linked lifecycle validation

Use fresh data for registration through AI completion, then RC26 scenarios for later date-dependent stages:

```text
Register Farmer
→ Register Animal
→ Submit AI request
→ Claim
→ Schedule
→ Complete AI
→ Validate Farmer observation state
→ Validate official pregnancy diagnosis
→ Validate continuation/follow-up when required
→ Validate confirmed pregnancy
→ Validate calving outcomes
→ Validate offspring and postpartum restrictions
→ Compare Farmer Mobile, Technician Mobile, Technician Web, and Admin
```

Manual MongoDB date edits or record corrections invalidate the run.

Regression owner sign-off: `TBD`

QA Lead approval: `TBD`

Date: `TBD`
