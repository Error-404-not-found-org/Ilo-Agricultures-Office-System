# Technician Mobile QA Workbook

## Assignment

- Tester: John Arvy Lopez
- Platform: supported Technician mobile workflows
- Branch/commit: `TBD by QA Lead`
- Device and Android version: `TBD`
- Primary account: `QA-TECH-MOBILE-01`
- Secondary concurrency account: coordinate with QA Lead

## Test cases

| Test ID | Test | Expected result | Seed/fresh data | Status | Evidence or bug ID |
| --- | --- | --- | --- | --- | --- |
| TM-AUTH-01 | Sign in as Technician | Technician reaches Technician Mobile workflows only | Test account | NOT RUN | |
| TM-REQ-01 | See new AI request | Fresh Farmer request appears with correct Animal/Farmer | Fresh | NOT RUN | |
| TM-REQ-02 | See new Health request | Symptoms, urgency, preferred visit, and evidence are visible | Fresh | NOT RUN | |
| TM-REQ-03 | Claim request | Request becomes assigned to this Technician | Fresh | NOT RUN | |
| TM-REQ-04 | Concurrent claim | Second Technician receives a conflict; assignment is unchanged | Fresh | NOT RUN | |
| TM-SCH-01 | Schedule assigned request | Correct date/time appears on Farmer, Web, and Mobile | Fresh | NOT RUN | |
| TM-SCH-02 | Schedule in the past | Scheduling is rejected with readable guidance | Fresh | NOT RUN | |
| TM-SCH-03 | Create overlapping visit | Conflict is rejected without changing either visit | Fresh | NOT RUN | |
| TM-AI-01 | Open scheduled AI visit | Correct request, Farmer, Animal, and prior-attempt context load | QA-RC-03 | NOT RUN | |
| TM-AI-02 | Complete AI service | One Insemination is created and operational records close | QA-RC-03 | NOT RUN | |
| TM-AI-03 | Retry/double-submit AI | Exactly one Insemination remains | QA-RC-03 | NOT RUN | |
| TM-PD-01 | Attempt Day 10 diagnosis | Action is blocked and eligible date is explained | QA-RC-04 | NOT RUN | |
| TM-PD-02 | Review Farmer observation | Report, signs, notes, and photos are clearly non-official | QA-RC-05/06 | NOT RUN | |
| TM-PD-03 | Perform due diagnosis | Correct AI attempt is updated exactly once | QA-RC-07 | NOT RUN | |
| TM-PD-04 | Duplicate diagnosis attempt | Duplicate is blocked; no stale active task remains | QA-RC-07 | NOT RUN | |
| TM-PD-05 | Record follow-up required | Existing lifecycle is retained and follow-up is scheduled once | QA-RC-07 | NOT RUN | |
| TM-REAI-01 | Start re-insemination | Available only after verified failed attempt | QA-RC-15 | NOT RUN | |
| TM-REAI-02 | Review Attempt 2 | Attempt 2 links to Attempt 1 and numbering is correct | QA-RC-16 | NOT RUN | |
| TM-CALV-01 | Open due-today calving | Correct mother/Pregnancy loads and is classified Due Today | QA-RC-09 | NOT RUN | |
| TM-CALV-02 | Open overdue calving | Correct overdue state and action are shown | QA-RC-10 | NOT RUN | |
| TM-CALV-03 | Record single live birth | One Calving and one offspring are created | QA-RC-09/10 | NOT RUN | |
| TM-CALV-04 | Record mixed/twin outcome | Counts and offspring creation match the submitted outcome | QA-RC-10 | NOT RUN | |
| TM-CALV-05 | Retry/double-submit calving | No duplicate Calving or offspring records are created | QA-RC-10 | NOT RUN | |
| TM-HLTH-01 | Start scheduled Health visit | Early start is blocked; permitted visit can begin | Fresh | NOT RUN | |
| TM-HLTH-02 | Complete Health service | One Medical Record is created and request resolves | Fresh | NOT RUN | |
| TM-OFF-01 | Queue a supported offline mutation | Operation is queued once and clearly marked pending | Fresh | NOT RUN | |
| TM-OFF-02 | Restore connectivity | Queue reconciles once; no duplicate official record | Fresh | NOT RUN | |
| TM-SYNC-01 | Compare with Technician Web | Request, task, schedule, and official outcomes agree | Mixed | NOT RUN | |

## Required negative checks

- Technician cannot complete a request assigned to another Technician.
- Health and AI service cannot start before required scheduling.
- Official service completion cannot be replaced by a generic task-complete action.
- Offline/retry behavior never reports false success.
- Farmer observation is never converted into official pregnancy without Technician diagnosis.

## Completion summary

| Result | Count |
| --- | ---: |
| Passed | 0 |
| Failed | 0 |
| Blocked | 0 |
| Not run | 28 |

Tester sign-off: `TBD`

Date: `TBD`
