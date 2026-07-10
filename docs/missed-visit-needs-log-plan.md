# BreedSmart Mobile Plan: Missed Visit and Needs Service Log Handling

## Summary

This plan defines how BreedSmart should handle scheduled technician work that is not completed on time.

The system should not auto-complete AI, health, pregnancy check, calving, or general farm visit work. If a scheduled visit passes without the required record, the backend and UI should clearly show that the work is overdue, missed, or still needs an official service log.

The goal is to prevent silent unfinished work while keeping farmer-facing language calm and clear.

## Current Behavior

- Scheduled AI, health, and task records can remain `scheduled`, `approved`, `pending`, or `in-progress` after the scheduled date passes.
- The technician dashboard and visit calendar already have some `overdue` UI handling.
- Generic farm visits remain `Pending` or `In Progress` until the technician completes or cancels them.
- Official service work must be completed through the official form, not by simply completing a generic task.
- The reminder job exists, but it may miss some `scheduled` statuses depending on the workflow.
- Farmer-facing screens do not consistently explain that a visit is waiting for technician results.

## Core Rule

Never mark field work as completed unless an actual official record exists.

Examples:

- AI visit is completed only when an AI/insemination record is submitted.
- Health visit is completed only when health findings, treatment notes, or resolution are submitted.
- Pregnancy check is completed only when a pregnancy result is submitted.
- Calving visit is completed only when calving and offspring details are recorded.
- General farm visit may be completed through the generic task completion flow.

## Shared Schedule States

Create one shared schedule-state rule used by backend and mobile UI.

Recommended fields:

```ts
scheduleState:
  | "upcoming"
  | "today"
  | "missed"
  | "needs_log"
  | "completed"
  | "cancelled";

scheduleLabel: string;
scheduleWarning?: string;
requiresOfficialRecord: boolean;
```

State meanings:

- `upcoming`: scheduled date is in the future.
- `today`: scheduled date is today.
- `missed`: scheduled date is before today and the task/visit has not been completed.
- `needs_log`: official service visit was scheduled or happened, but the required official service form has not been submitted.
- `completed`: official record exists or generic task was completed.
- `cancelled`: request/task was cancelled.

Example response:

```json
{
  "scheduleState": "needs_log",
  "scheduleLabel": "Needs Service Log",
  "scheduleWarning": "This AI visit was scheduled already, but no AI record has been submitted yet.",
  "requiresOfficialRecord": true
}
```

## Phase 1: Backend Schedule State

Add shared schedule-state calculation for:

- AI requests / insemination records.
- Health assistance requests.
- Pregnancy diagnosis tasks.
- Calving-related work.
- Generic tasks / farm visits.

Apply the calculated fields to responses used by:

- Technician dashboard agenda.
- Technician request board / work queue.
- Visit calendar.
- Request details.
- Farmer home upcoming visits.
- Farmer service request list.

Important:

- Do not break existing status values immediately.
- Add schedule-state fields as additive response fields first.
- Keep existing `status`, `scheduledDate`, and `overdue` fields during transition.

## Phase 2: Reminder Logic

Improve reminder automation.

Rules:

- Include `scheduled` records in reminder checks, not only `approved` and `in-progress`.
- Send technician reminder for work scheduled today.
- Send stronger technician reminder for work already overdue.
- Do not auto-complete records.
- Do not notify the farmer that work is completed unless an official record exists.

Suggested reminder schedule:

- Morning: scheduled visits for today.
- 4:00 PM: service logs still pending for today.
- Next day: missed visit or service log still required.

## Phase 3: Technician Home UI

Update Today’s Visits.

Display:

- `Today` for visits scheduled today.
- `Upcoming` for future scheduled visits if shown.
- `Missed` for generic visits that passed without completion.
- `Needs Log` for official services that passed without the official form.

Button behavior:

- AI: `Record AI`
- Health: `Add Health Log`
- Pregnancy Check: `Record Pregnancy Check`
- Calving: `Record Calving`
- General Visit: `Complete Visit`

Keep the section action as `Open Calendar`.

## Phase 4: Visit Calendar UI

Update calendar cards to show one visible status pill:

- `Today`
- `Upcoming`
- `Missed`
- `Needs Log`
- `Completed`
- `Cancelled`

For missed official service work, show a small warning:

```text
Service record required.
```

Tapping behavior:

- Official service item opens request details or the correct official form.
- Generic task opens task details.

## Phase 5: Work Queue UI

Update task/request lists so technicians can quickly understand what needs action.

Recommended sort order:

1. Emergency or high urgency.
2. Missed / needs log.
3. Today.
4. Upcoming.
5. Older normal pending work.

Rules:

- Official service tasks should not have a plain generic complete button.
- Official service tasks should show: `Complete through official form`.
- Generic visits can still use the normal complete action.

## Phase 6: Request Details UI

Add a warning banner when scheduled official service work is overdue and has no official record.

Example:

```text
Service log required
This AI visit was scheduled already, but no AI record has been submitted yet.
```

The primary action should route to the correct official form:

- AI request -> Record AI.
- Health request -> Add Health Log / Treatment Notes.
- Pregnancy diagnosis -> Record Pregnancy Check.
- Calving -> Record Calving.

## Phase 7: Farmer UI

Use softer wording for farmers.

Farmer-facing labels:

- Scheduled today: `Technician visit scheduled today`.
- Scheduled date passed but no result: `Pending technician update`.
- Completed: show only after an official record exists.
- Cancelled: show cancellation status and reason if available.

Avoid showing alarming labels like `Missed` unless the technician or admin officially confirms the visit was missed.

Apply to:

- Farmer Home upcoming visits.
- My Service Requests.
- Animal profile timeline.

## Phase 8: Admin Monitoring

Add admin visibility later.

Recommended admin metrics:

- Missed scheduled visits count.
- Needs service log count.
- Technician workload with overdue logs.
- Barangay/municipality delayed service summary.
- Repeated missed visit patterns.

This is useful for office monitoring but should not block mobile field testing.

## Test Plan

Test these scenarios:

1. AI scheduled tomorrow -> shows `Upcoming`.
2. AI scheduled today -> shows `Today`.
3. AI scheduled yesterday without AI record -> technician sees `Needs Log`.
4. AI scheduled yesterday with AI record -> shows `Completed`.
5. Health request scheduled yesterday without findings/treatment -> technician sees `Needs Log`.
6. Generic farm visit yesterday not completed -> technician sees `Missed`.
7. Generic farm visit completed -> shows `Completed`.
8. Farmer view for overdue service says `Pending technician update`, not `Completed`.
9. Reminder job includes `scheduled` records.
10. Official service task cannot be completed without official form.
11. Visit Calendar, Technician Home, Request Details, and Work Queue all show the same state.

## Recommended Implementation Order

1. Backend additive schedule-state fields.
2. Technician Home status badges/actions.
3. Visit Calendar status badges/actions.
4. Request Details warning and form routing.
5. Work Queue sorting and official-service action labels.
6. Farmer Home and My Service Requests wording.
7. Reminder job refinement.
8. Admin monitoring.

## Antigravity Prompt

Use this prompt if Antigravity continues the work:

```text
Read docs/missed-visit-needs-log-plan.md and implement it incrementally.

Important constraints:
- Do not auto-complete any AI, health, pregnancy check, calving, or farm visit work.
- Official services must be completed only through their official service forms.
- Add schedule-state fields as additive backend response fields first; do not remove existing status fields.
- Keep farmer-facing wording calm: use "Pending technician update" instead of "Missed" unless the visit is officially confirmed missed.
- Update Technician Home, Visit Calendar, Request Details, and Work Queue before touching Admin monitoring.
- Preserve current navigation and existing BreedSmart visual style.

Start with backend schedule-state calculation and apply it to technician dashboard agenda, request details, visit calendar, and farmer upcoming visits responses.
Then update the mobile UI to show Today, Upcoming, Missed, Needs Log, Completed, and Cancelled consistently.

Run backend syntax checks, mobile TypeScript checks, and targeted manual QA for:
- scheduled today
- scheduled yesterday with no official record
- scheduled yesterday with official record
- generic visit overdue
- farmer service request pending technician update
```

