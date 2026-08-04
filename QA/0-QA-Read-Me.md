# BreedSmart QA Round 1

## Purpose

This folder is the working QA kit for BreedSmart discovery testing. Round 1 is intended to find workflow, data-integrity, synchronization, permission, and interface defects before the release branch is considered for `main`.

Starting QA does not mean the application is release-ready. It means the test environment is stable enough to collect reliable evidence.

## Release boundary

- Test branch: `codex/mobile-readiness-checkpoint`
- Baseline commit: `e2275a4`
- Database: development/test database only
- Production domain: do not use for QA mutations
- Production database: never use
- Seeder owner: QA Lead only

The QA Lead must update the baseline commit above whenever an approved fix is pushed. Every tester must confirm the same commit before testing.

## Team assignments

| Responsibility | Team member | Primary workbook |
| --- | --- | --- |
| QA Lead, Admin, environment and triage | John Lloyd Cabanig | [QA Lead Progress Tracker](./8%20-%20QA%20Lead%20Progress%20Tracker.md) |
| Farmer Mobile | Nelmar Buenafe | [Farmer Mobile Workbook](./2-Farmer%20Mobile%20Workbook.md) |
| Technician Mobile | John Arvy Lopez | [Technician Mobile Workbook](./3%20-%20Technician%20Mobile%20Workbook.md) |
| Technician Web | Justine Balmores | [Technician Web Workbook](./4%20-%20Technician%20Web%20Workbook.md) |
| Documentation and Regression | Gian Rovik Somes | [Regression Workbook](./5%20-%20Regression%20Workbook.md) |

## Required documents

1. [Seed Scenario Reference Guide](./1-Seed%20Scenario%20Reference%20Guide.md)
2. [Farmer Mobile Workbook](./2-Farmer%20Mobile%20Workbook.md)
3. [Technician Mobile Workbook](./3%20-%20Technician%20Mobile%20Workbook.md)
4. [Technician Web Workbook](./4%20-%20Technician%20Web%20Workbook.md)
5. [Regression Workbook](./5%20-%20Regression%20Workbook.md)
6. [Bug Report Template](./6%20-%20Bug%20Report%20Template.md)
7. [Test Accounts](./7%20-%20Test%20Accounts.md)
8. [QA Lead Progress Tracker](./8%20-%20QA%20Lead%20Progress%20Tracker.md)

## Test status vocabulary

Use only:

- `NOT RUN` — testing has not started.
- `PASS` — actual behavior matches every expected result.
- `FAIL` — at least one expected result is incorrect.
- `BLOCKED` — an external prerequisite or earlier defect prevents execution.
- `RETEST` — a fix is available and needs verification.

Never mark a test `PASS` without evidence.

## Severity definitions

| Severity | Definition | Examples |
| --- | --- | --- |
| Blocker | Testing or a critical workflow cannot continue, or data/security is unsafe. | Cannot authenticate, server unavailable, data corruption, unauthorized access |
| High | A core workflow completes incorrectly or cannot be completed. | Duplicate official record, wrong animal linkage, Health request missing from operational queue |
| Medium | Workflow works with a workaround or presents incorrect secondary behavior. | Stale status, incorrect message, broken Back navigation |
| Low | Cosmetic or minor usability issue with no data/workflow impact. | Alignment, spacing, minor copy |

## Shared failure report

Every failure must be copied into the shared **BreedSmart Bug Report** using the template in this folder.

Record:

- Test ID
- Web or Mobile
- User role
- Tested branch and commit
- Animal tag and request/task ID
- Steps performed
- Expected result
- Actual result
- Screenshot or recording
- Browser console or Mobile log
- Failed API request and response
- Severity

Do not include passwords, Clerk secrets, database credentials, or private production data.

## Environment setup

### Source code

Each teammate testing from source must run:

```powershell
git fetch origin
git switch codex/mobile-readiness-checkpoint
git pull --ff-only origin codex/mobile-readiness-checkpoint
git log -1 --oneline
```

The final command must match the QA Lead's recorded baseline.

### Shared services

- Prefer one shared development Backend instance.
- Web and Mobile must point to the same development Backend.
- The Backend must point to the development/test database.
- Use Clerk development accounts and keys.
- Share `.env` values privately; never commit them.
- Avoid multiple Backend instances against the same shared database during a coordinated run.

## Round 1 execution order

### Gate 0 — Environment smoke test

The QA Lead verifies:

- Farmer, Technician, second Technician, and Admin can authenticate.
- Backend, Web, Farmer Mobile, and Technician Mobile start.
- One authenticated API request succeeds on each client.
- One fresh Farmer and Animal can be created.
- All testers see the same baseline commit.

If this gate fails, stop and fix the Blocker before group testing.

### Gate 1 — Seed preparation

- Complete the test-account register.
- Run the lifecycle seeder in dry-run mode.
- Confirm the development database name and selected accounts.
- Execute the seeder once.
- Save the exact generated manifest path in the QA Lead tracker.

### Gate 2 — Discovery testing

- Testers use their assigned workbooks.
- Each tester uses separate fresh records unless a seed scenario is explicitly assigned.
- Capture evidence before attempting a workaround.
- Do not edit database records manually.
- Do not clean seeded data while another tester is using it.

### Gate 3 — Triage and fixes

The QA Lead reviews failures daily:

1. Blocker
2. High data integrity, permission, and workflow failures
3. Medium synchronization, status, and navigation failures
4. Low visual and copy defects

### Gate 4 — Retest and regression

- Pull the approved fix commit.
- Retest the exact failed case.
- Run the relevant neighboring workflows.
- Update the bug report with evidence.
- Never close a defect only because the code changed.

### Gate 5 — Release candidate

A release candidate requires:

- Zero open Blockers
- Zero open High-severity defects
- Critical regression suite passed
- Automated Backend, Web, and Mobile checks passed
- Work Queue, Service Requests, Schedule, records, and notifications agree
- Final linked lifecycle validation completed without manual database correction

## Important lifecycle limitation

One newly registered animal cannot progress from AI request to calving during a short QA session because pregnancy rules depend on real dates. Use:

- Fresh manual records for registration through AI completion.
- RC26 seed scenarios for date-dependent pregnancy, calving, postpartum, and re-insemination states.

Do not alter dates directly in MongoDB to force progression.

## Success confirmation

The success statement in the QA Lead tracker may only be signed after all release-candidate gates pass. Until then, the correct result is a defect inventory and prioritized remediation plan.
