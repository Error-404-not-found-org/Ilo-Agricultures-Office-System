# Technician Web QA Workbook

## Assignment

- Tester: Justine Balmores
- Platform: Technician Web
- Branch/commit: `TBD by QA Lead`
- Browser/version: `TBD`
- Screen sizes: 1366×768, narrow laptop, tablet, mobile width
- Account: `QA-TECH-WEB-01`

## Accounts, Farmers, and Animals

| Test ID | Test | Expected result | Data | Status | Evidence or bug ID |
| --- | --- | --- | --- | --- | --- |
| TW-AUTH-01 | Sign in as Technician | Technician dashboard opens; Admin/Farmer routes remain protected | Account | NOT RUN | |
| TW-REG-01 | Register Farmer | Validation works and Farmer appears once | Fresh | NOT RUN | |
| TW-REG-02 | Open Farmer name | React Router opens the correct Farmer profile | Fresh | NOT RUN | |
| TW-REG-03 | Register Animal | Correct owner and fields persist across Web/Mobile | Fresh | NOT RUN | |
| TW-REG-04 | Open Animal name | Correct Livestock Profile opens | Fresh | NOT RUN | |
| TW-REG-05 | Missing profile images | Round fallback appears without broken-image icon | Fresh | NOT RUN | |

## Service Requests

| Test ID | Test | Expected result | Data | Status | Evidence or bug ID |
| --- | --- | --- | --- | --- | --- |
| TW-REQ-01 | View Available Health request | Modal shows service, Animal, symptoms, urgency, preferred visit, notes, and photos | Fresh | NOT RUN | |
| TW-REQ-02 | Check privacy before claim | Exact contact/farm details remain hidden until claim | Fresh | NOT RUN | |
| TW-REQ-03 | Claim Health request | Request moves to My Requests and is assigned once | Fresh | NOT RUN | |
| TW-REQ-04 | Concurrent claim | Second Technician cannot claim it | Fresh | NOT RUN | |
| TW-REQ-05 | Schedule Health request | Correct date/time persist and early/past/conflict guards work | Fresh | NOT RUN | |
| TW-REQ-06 | Complete Health request | One Medical Record is created and status becomes resolved | Fresh | NOT RUN | |
| TW-REQ-07 | Health early-start warning | Warning includes the actual scheduled date and time | Fresh | NOT RUN | |
| TW-REQ-08 | Claim/schedule AI request | My Requests, Schedule, and Farmer Mobile agree | Fresh | NOT RUN | |
| TW-REQ-09 | Modal field locking | Future service metrics cannot be entered before workflow permits | Fresh | NOT RUN | |

## Work Queue and Schedule

| Test ID | Test | Expected result | Data | Status | Evidence or bug ID |
| --- | --- | --- | --- | --- | --- |
| TW-WQ-01 | Health request inclusion | Claimed/operational Health Assistance appears in Work Queue | Fresh | NOT RUN | |
| TW-WQ-02 | AI task inclusion | Scheduled/assigned AI visit appears once | QA-RC-03 | NOT RUN | |
| TW-WQ-03 | Pregnancy task inclusion | Due diagnosis and follow-up stages use correct labels/actions | QA-RC-07 | NOT RUN | |
| TW-WQ-04 | Calving task inclusion | Due and overdue calving tasks open correct workflow | QA-RC-09/10 | NOT RUN | |
| TW-WQ-05 | Default active queue | Completed/cancelled are excluded; paused is On Hold only | Mixed | NOT RUN | |
| TW-WQ-06 | Date classification | Due Today uses local Philippine date; Upcoming excludes Today | Mixed | NOT RUN | |
| TW-WQ-07 | Completed-this-week count | Only current local week completions are counted | Mixed | NOT RUN | |
| TW-WQ-08 | Existing official outcome | Completed official record does not leave an overdue task | QA-RC-07/11 | NOT RUN | |
| TW-WQ-09 | Kebab/action controls | Mouse and keyboard actions work with visible focus | Mixed | NOT RUN | |
| TW-WQ-10 | Filter return state | Back navigation restores scope, filters, search, and page | Mixed | NOT RUN | |
| TW-SCH-01 | Schedule consistency | Service Requests, Work Queue, and Schedule show identical values | Fresh | NOT RUN | |
| TW-SCH-02 | Reschedule/cancel | All operational views update and stale entries disappear | Fresh | NOT RUN | |

## Reproduction and Health workflows

| Test ID | Test | Expected result | Data | Status | Evidence or bug ID |
| --- | --- | --- | --- | --- | --- |
| TW-AI-01 | Complete scheduled AI | Correct Farmer/Animal are locked and one record is created | QA-RC-03 | NOT RUN | |
| TW-AI-02 | Retry AI submission | Retry does not duplicate Insemination or task completion | QA-RC-03 | NOT RUN | |
| TW-PD-01 | Day 10 diagnosis | Locked with truthful eligible date | QA-RC-04 | NOT RUN | |
| TW-PD-02 | Farmer observation details | Signs, notes, photos, and report type are visible | QA-RC-05/06 | NOT RUN | |
| TW-PD-03 | Due diagnosis | Correct result, method, and AI linkage persist | QA-RC-07 | NOT RUN | |
| TW-PD-04 | Duplicate diagnosis | Duplicate is blocked and stale task is reconciled | QA-RC-07 | NOT RUN | |
| TW-PD-05 | Continuation/follow-up | Existing Pregnancy is updated; no duplicate Pregnancy | QA-RC-07 | NOT RUN | |
| TW-REAI-01 | Re-insemination | Available for verified failed attempt only | QA-RC-15/16 | NOT RUN | |
| TW-CALV-01 | Due/overdue calving | Correct context and readiness are shown | QA-RC-09/10 | NOT RUN | |
| TW-CALV-02 | Record outcomes | Live, twins, stillbirth, mixed, difficult, and cesarean map truthfully | Controlled | NOT RUN | |
| TW-CALV-03 | Retry calving | No duplicate Calving or offspring | Controlled | NOT RUN | |

## Interface and accessibility

| Test ID | Test | Expected result | Status | Evidence or bug ID |
| --- | --- | --- | --- | --- |
| TW-UI-01 | Light and dark mode | Essential text, placeholders, badges, and tables remain readable | NOT RUN | |
| TW-UI-02 | Dashboard width | No page-level overflow to the right | NOT RUN | |
| TW-UI-03 | Table responsiveness | Table scrolls internally and columns do not overlap | NOT RUN | |
| TW-UI-04 | Modal responsiveness | Modal fits viewport and content remains reachable | NOT RUN | |
| TW-UI-05 | Keyboard navigation | Links, rows/actions, menus, forms, and modals are operable | NOT RUN | |
| TW-UI-06 | Focus visibility | Interactive controls have visible focus state | NOT RUN | |
| TW-UI-07 | Error/empty/loading states | States are readable and provide recovery where applicable | NOT RUN | |
| TW-UI-08 | User-facing terminology | No raw enums, codes, internal IDs, or seed labels | NOT RUN | |

## Completion summary

| Result | Count |
| --- | ---: |
| Passed | 0 |
| Failed | 0 |
| Blocked | 0 |
| Not run | 46 |

Tester sign-off: `TBD`

Date: `TBD`
