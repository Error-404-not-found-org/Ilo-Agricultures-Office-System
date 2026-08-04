# BreedSmart QA Lead Progress Tracker

## Round information

| Field | Value |
| --- | --- |
| QA Lead | John Lloyd Cabanig |
| Round | Round 1 — Discovery |
| Branch | `codex/mobile-readiness-checkpoint` |
| Baseline commit | `e2275a4` |
| Start date | TBD |
| Target end date | TBD |
| Development Backend URL | TBD |
| Development database name | TBD |
| Farmer Mobile build | TBD |
| Technician Mobile build | TBD |
| Technician Web URL | Local/TBD |
| Seed manifest path | TBD |

## Entry gates

| Gate | Owner | Status | Evidence/notes |
| --- | --- | --- | --- |
| QA documents completed and reviewed | QA Lead | NOT RUN | |
| Test accounts verified | QA Lead | NOT RUN | |
| All testers on same commit | QA Lead | NOT RUN | |
| Backend/Web/Mobile point to development environment | QA Lead | NOT RUN | |
| Authentication smoke test | All roles | NOT RUN | |
| Fresh Farmer registration smoke test | Technician Web | NOT RUN | |
| Fresh Animal registration smoke test | Technician Web | NOT RUN | |
| Seeder dry run reviewed | QA Lead | NOT RUN | |
| Seeder executed once and manifest saved | QA Lead | NOT RUN | |

## Team progress

| Tester | Area | Total tests | Passed | Failed | Blocked | Not run | Sign-off |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Nelmar Buenafe | Farmer Mobile | 26 | 0 | 0 | 0 | 26 | |
| John Arvy Lopez | Technician Mobile | 28 | 0 | 0 | 0 | 28 | |
| Justine Balmores | Technician Web | 46 | 0 | 0 | 0 | 46 | |
| Gian Rovik Somes | Regression | 30 | 0 | 0 | 0 | 30 | |
| John Lloyd Cabanig | Admin/environment/triage | TBD | 0 | 0 | 0 | TBD | |

## Seed scenario progress

| QA ID | Primary owner | Status | Bug/evidence |
| --- | --- | --- | --- |
| QA-RC-01 | Farmer Mobile | NOT RUN | |
| QA-RC-02 | Farmer Mobile | NOT RUN | |
| QA-RC-03 | Technician Mobile/Web | NOT RUN | |
| QA-RC-04 | Farmer + Technician | NOT RUN | |
| QA-RC-05 | Farmer + Technician | NOT RUN | |
| QA-RC-06 | Technician Mobile/Web | NOT RUN | |
| QA-RC-07 | Technician Mobile/Web | NOT RUN | |
| QA-RC-08 | Farmer + Admin cross-check | NOT RUN | |
| QA-RC-09 | Technician Mobile/Web | NOT RUN | |
| QA-RC-10 | Technician Mobile/Web | NOT RUN | |
| QA-RC-11 | Farmer + Regression | NOT RUN | |
| QA-RC-12 | Farmer + Regression | NOT RUN | |
| QA-RC-13 | Farmer + Regression | NOT RUN | |
| QA-RC-14 | Farmer + Regression | NOT RUN | |
| QA-RC-15 | Technician Mobile/Web | NOT RUN | |
| QA-RC-16 | Technician Mobile/Web | NOT RUN | |

## Defect summary

| Severity | Open | In progress | Ready for retest | Verified |
| --- | ---: | ---: | ---: | ---: |
| Blocker | 0 | 0 | 0 | 0 |
| High | 0 | 0 | 0 | 0 |
| Medium | 0 | 0 | 0 | 0 |
| Low | 0 | 0 | 0 | 0 |

## Defect register

| Bug ID | Test ID | Title | Severity | Owner | Status | Fix commit |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

## Daily triage log

### Date: TBD

- New Blockers:
- New High defects:
- Decisions:
- Fix owners:
- Retests required:
- Environment changes:

## Known validation focus

These are areas requiring early evidence, not automatically accepted defects:

- A claimed/operational Health request must appear in the Technician Work Queue.
- Work Queue, Service Requests, and Schedule must show the same assignment and date/time.
- Existing official outcomes must not leave stale overdue tasks.
- Duplicate AI, pregnancy diagnosis, Health completion, and calving submissions must not create duplicate records.
- Farmer observation must never appear as official pregnancy diagnosis.

## Exit gates

| Gate | Status | Evidence |
| --- | --- | --- |
| Zero open Blockers | NOT MET | |
| Zero open High defects | NOT MET | |
| All fixed Blocker/High cases retested | NOT MET | |
| Critical regression suite passed | NOT MET | |
| Backend automated checks passed | NOT MET | |
| Mobile TypeScript/lint passed | NOT MET | |
| Web tests/lint/build passed | NOT MET | |
| PR-level `git diff --check` passed | NOT MET | |
| Final linked lifecycle validation passed | NOT MET | |
| Manual light/dark/responsive/keyboard checks passed | NOT MET | |
| Exact seed manifest cleanup reviewed/completed | NOT MET | |

## Release decision

- [ ] NOT READY — discovery or fixes in progress
- [ ] CONDITIONAL — regression/retest remains
- [ ] APPROVED — all exit gates passed

### Success confirmation

Do not sign this section until `APPROVED` is selected.

> BreedSmart Complete Workflow Testing has passed on commit `__________`. Farmer and livestock registration, Health and AI requests, Technician claiming and scheduling, Work Queue and Schedule synchronization, Health and AI completion, Farmer observations, official pregnancy diagnosis, continuation/re-insemination rules, calving and postpartum behavior, permissions, accessibility, and cross-platform data consistency were verified. No Blocker or High-severity defects remain.

QA Lead signature: `TBD`

Regression owner signature: `TBD`

Approval date: `TBD`
