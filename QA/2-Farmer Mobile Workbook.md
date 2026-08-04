# Farmer Mobile QA Workbook

## Assignment

- Tester: Nelmar Buenafe
- Platform: BreedSmart Farmer Android application
- Branch/commit: `TBD by QA Lead`
- Device and Android version: `TBD`
- Test account: `QA-FARMER-01`

## Execution record

For each test, enter `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` and link the evidence or bug ID.

| Test ID | Test | Expected result | Seed/fresh data | Status | Evidence or bug ID |
| --- | --- | --- | --- | --- | --- |
| FM-AUTH-01 | Sign in as Farmer | Farmer reaches Farmer Mobile; no staff interface is exposed | Test account | NOT RUN | |
| FM-AUTH-02 | Sign out and reopen | Session is cleared and protected screens are inaccessible | Test account | NOT RUN | |
| FM-ANM-01 | Register a fresh Animal | Required fields validate and Animal appears once | Fresh | NOT RUN | |
| FM-ANM-02 | Submit duplicate ear tag | Duplicate is rejected without creating another Animal | Fresh | NOT RUN | |
| FM-ANM-03 | Open Animal details without image | Correct round fallback appears and details remain readable | Fresh | NOT RUN | |
| FM-AI-01 | Submit first AI request | Request succeeds and becomes visible to Technicians | QA-RC-01 | NOT RUN | |
| FM-AI-02 | Submit duplicate active AI request | Request is blocked; existing request remains unchanged | QA-RC-02 | NOT RUN | |
| FM-AI-03 | Review scheduled AI visit | Correct date, time, Animal, and service progress appear | QA-RC-03 | NOT RUN | |
| FM-OBS-01 | Check Day 10 state | Diagnosis is unavailable; waiting guidance is truthful | QA-RC-04 | NOT RUN | |
| FM-OBS-02 | Submit Farmer observation | Observation succeeds and is not called an official diagnosis | QA-RC-05 | NOT RUN | |
| FM-OBS-03 | Add notes/photos to observation | Evidence remains attached and visible to Technician review | QA-RC-05 | NOT RUN | |
| FM-OBS-04 | Review likely-pregnant observation | “Farmer observation” and verification status are distinct | QA-RC-06 | NOT RUN | |
| FM-PREG-01 | Review confirmed pregnancy | Official diagnosis and expected-calving information agree | QA-RC-08 | NOT RUN | |
| FM-PREG-02 | Attempt AI during active pregnancy | AI request is blocked with a readable reason | QA-RC-08 | NOT RUN | |
| FM-CALV-01 | Review live-birth record | Offspring and mother lineage are visible | QA-RC-11 | NOT RUN | |
| FM-CALV-02 | Review stillbirth record | Zero living offspring; truthful outcome language | QA-RC-12 | NOT RUN | |
| FM-CALV-03 | Review pregnancy-loss record | No offspring; parity and recovery state remain correct | QA-RC-13 | NOT RUN | |
| FM-CALV-04 | Review mixed outcome | One living offspring plus one stillborn outcome | QA-RC-14 | NOT RUN | |
| FM-POST-01 | Attempt AI during postpartum recovery | Request is blocked and recovery guidance is shown | QA-RC-11 | NOT RUN | |
| FM-HLTH-01 | Submit Health request with preferred visit | Symptoms, urgency, notes, date/time, and photo persist | Fresh | NOT RUN | |
| FM-HLTH-02 | Review claimed Health request | Assigned Technician and progress update correctly | Fresh | NOT RUN | |
| FM-HLTH-03 | Review scheduled Health request | Scheduled date/time matches Technician clients | Fresh | NOT RUN | |
| FM-HLTH-04 | Review resolved Health request | Medical record appears exactly once with treatment/advice | Fresh | NOT RUN | |
| FM-NOTIF-01 | Review lifecycle notifications | Notifications open the correct record and do not duplicate it | Mixed | NOT RUN | |
| FM-SYNC-01 | Refresh after Technician update | Latest official status appears without reinstalling/signing out | Mixed | NOT RUN | |
| FM-OFF-01 | Lose connectivity during safe read flow | Clear offline state appears; app does not fabricate success | Fresh | NOT RUN | |

## Required negative checks

- Farmer cannot access another Farmer's Animal by changing an ID or deep link.
- Farmer cannot record an official pregnancy diagnosis.
- Farmer cannot use Technician or Admin routes.
- A timeout or repeated tap does not create duplicate requests.
- Raw backend codes, enum values, test prefixes, and database IDs are not displayed.

## Completion summary

| Result | Count |
| --- | ---: |
| Passed | 0 |
| Failed | 0 |
| Blocked | 0 |
| Not run | 26 |

Tester sign-off: `TBD`

Date: `TBD`
