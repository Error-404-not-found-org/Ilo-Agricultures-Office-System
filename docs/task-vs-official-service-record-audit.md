# BreedSmart Task vs Official Service Record Architecture Audit

Date: 2026-06-30

Scope inspected:

- `backend`
- `mobile`
- `web`

Note: the project was already promoted from `backend_2.0` / `mobile_2.0` to `backend` / `mobile`. This report uses the active folder names.

## Executive Summary

BreedSmart currently has two different workflow concepts that are partly mixed:

- **Official service records**: AI/insemination, health request/log, pregnancy diagnosis, and calving records. These are the records that should affect animal history, reports, request queues, dashboards, and analytics.
- **Generic technician tasks**: `Task` records. These should be reminders, appointments, visit plans, and operational to-do items.

The safest architecture is:

```text
Task = reminder / appointment / operational assignment
Request = farmer-submitted official service request
Record = completed official animal history
```

The current implementation is close in some places, but it has one risky pattern: the mobile `create-task` screen allows AI, Health, and Vaccination-like data to be saved as plain text in `Task.notes`. That does not create official service records, does not update the animal timeline, and does not reliably appear in reports.

## Current Architecture Summary

### Backend Task Model

`backend/src/models/task.model.js` supports:

- `technicianId`
- `farmerId`
- `animalIds`
- `taskType`
- `category`
- `priority`
- `notes`
- `status`
- `dueDate`
- `sourceType`
- `metadata`

The current `taskType` enum is:

- `AI`
- `PD`
- `CD`
- `Vaccination`
- `Deworming`
- `Treatment`
- `Registration`
- `Other`

This is usable, but it lacks clear names for `General Visit`, `Farm Inspection`, and `Health` as a general service category.

### Backend Task Controller

`backend/src/controllers/tasks.controllers.js` has these important behaviors:

- `GET /api/tasks` returns pending tasks assigned to the technician, unassigned tasks, or null-assigned tasks.
- `POST /api/tasks` currently reads only `farmerId`, `animalIds`, `category`, and `notes`.
- `POST /api/tasks` does **not** persist `taskType`, `dueDate`, `sourceType`, `metadata`, or priority.
- `PUT /api/tasks/:id/complete` only marks the task as `Completed`.
- Completing a task does **not** create an official AI, health, pregnancy, or calving record.
- Completing a task does **not** update animal timeline, reports, or official service history.
- `GET /api/tasks/:id` already has special handling for `PD` tasks and loads linked insemination context.

### Mobile Task Creation

`mobile/app/(technician)/create-task.tsx`:

- Reads route params:
  - `type`
  - `farmerId`
  - `farmerName`
  - `phoneNumber`
  - `barangay`
  - `municipality`
  - `source`
- Prefills the farmer when `farmerId` is provided.
- Loads animals for that farmer.
- Defaults `serviceType` to `type || "AI"`.
- Has service buttons for:
  - Artificial Insemination
  - Health Check-up
  - Vaccination / Meds
  - Other Operation
- Requires at least one animal for every task.
- Stores AI/Health/Vaccination structured details inside `notes`.
- Sends `taskType` to the mobile service, but the backend currently ignores it.

### Mobile Task Detail

`mobile/app/(technician)/task-details.tsx`:

- If task is completed, it shows `Completed`.
- If `task.taskType === "PD"`, it redirects to `/(technician)/pregnancy-verification`.
- All other task types show `Mark as Completed`.

This means AI, Health, and Calving tasks are not forced into official service forms today.

### Technician To-Do List

`mobile/app/(technician)/technician.tasks.tsx`:

- Fetches `/api/tasks`.
- Shows pending tasks by category.
- Lets the technician open task details.
- Directly completes tasks through `/api/tasks/:id/complete`.

So created tasks do appear in the Technician To-Do List.

### Technician Calendar And Dashboard Agenda

`mobile/app/(technician)/technician.calendar.tsx` and `web/src/pages/technician/Schedule.jsx` read:

```text
/api/technician/dashboard-data?fullAgenda=true
```

That dashboard endpoint currently builds agenda items from:

- Insemination records
- Health requests

It does not include generic `Task` records. So a task created through `create-task` is not guaranteed to appear in the mobile or web calendar.

### Client Profile Recent Activity

`mobile/app/(technician)/client.profile.tsx` displays recent activity from `client.serviceHistory`.

`backend/src/controllers/user.controllers.js` builds farmer `serviceHistory` from:

- Insemination records
- Health requests

It does not include generic `Task` records. So a Schedule Visit task does not currently update Client Profile Recent Activity.

## Client Profile Schedule Visit Quick Action Audit

### Current Behavior

The Client Profile quick action uses:

```ts
router.push({
  pathname: "/(technician)/create-task",
  params: {
    farmerId: client._id,
    farmerName: clientName,
    phoneNumber: clientPhone,
    barangay: client.address?.barangay || "",
    municipality: client.address?.city || client.address?.municipality || "",
    source: "client-profile"
  }
})
```

This is directionally correct because it opens `create-task` with farmer context already selected.

But the current target screen is not yet correct for the label **Schedule Visit** because:

- It defaults to AI when no `type` is passed.
- It requires animal selection even for a general visit.
- It does not ask for a scheduled date or due date.
- The backend does not persist `dueDate`.
- The backend does not persist `taskType`.
- The created item is a to-do task, not a calendar appointment.

### Direct Answers

1. **Should Schedule Visit create only a generic Task?**

   Yes, if the visit is a general farm visit, follow-up, inspection, call, reminder, or operational appointment.

2. **Or should it create a visit/appointment record connected to the official workflow?**

   It should create a `Task` appointment first. If the technician chooses an official service type, the task should guide them into the official service form. The official service form should create the permanent record.

3. **If the visit is for a general farm visit, should it remain a Task?**

   Yes. General visits should remain `Task` records.

4. **If the visit is for AI, Health, Pregnancy Check, or Calving, should it redirect to the proper official service workflow instead?**

   Yes. The task can schedule the work, but completion must happen through the official form.

5. **Does `create-task` correctly read route params?**

   Yes. It reads `farmerId`, `farmerName`, `phoneNumber`, `barangay`, `municipality`, and `source`.

6. **Does `create-task` prefill client/farmer details?**

   Yes. It preselects the farmer from `farmerId`, using loaded client data when available and fallback route params when not.

7. **Does the created task appear in Technician To-Do List, Technician Calendar, and Dashboard Agenda?**

   - To-Do List: yes, through `/api/tasks`.
   - Technician Calendar: not reliably, because calendar uses dashboard agenda data, not `/api/tasks`.
   - Dashboard Agenda: not currently, because dashboard agenda is built from AI and health records, not generic tasks.

8. **Should Scheduled Visit from Client Profile appear in the technician calendar?**

   Yes. A scheduled visit should appear in the calendar if it has a `dueDate` or `scheduledDate`.

9. **Should it update the client profile recent activity?**

   Yes, but it should be visually separated from official service history. A general visit task can appear as operational activity, while AI/Health/Pregnancy/Calving records remain official service history.

10. **Should it be treated as a general visit task unless the technician selects a service type?**

   Yes. This is the safest default. The current default to AI is misleading and should be changed.

## Problems Found

### P0: Backend Ignores `taskType`

The mobile payload sends `taskType`, but `createTask` does not persist it. This means many manually created tasks become `Other`, even when the UI selected AI or Health.

### P0: Official Service Data Can Be Trapped In `Task.notes`

AI details like sire breed and sire code, and health details like diagnosis/treatment, can be saved as text in task notes instead of official records.

### P0: Task Completion Does Not Create Official Records

For non-PD tasks, `task-details` only marks the task completed. That is safe for general tasks but unsafe for AI, Health, Pregnancy Check, and Calving tasks.

### P1: Schedule Visit Is Not Actually Scheduled

The quick action says Schedule Visit, but `create-task` does not capture or persist `dueDate`. A created task cannot reliably appear in calendar/agenda.

### P1: Calendar And Dashboard Do Not Include Generic Tasks

The mobile and web calendars use `/api/technician/dashboard-data?fullAgenda=true`, which currently includes AI and health records but not generic tasks.

### P1: Client Recent Activity Excludes Generic Tasks

Client Profile Recent Activity uses `serviceHistory`, and the backend builds service history from AI and health records only.

### P1: Task Type Names Are Not Complete

The model has `CD`, `PD`, `Treatment`, and `Other`, but the UI uses labels like Health Check-up and Other Operation. There is no explicit `General Visit` or `Farm Inspection` task type.

### P2: Web Uses Agenda Workflow, Not Generic Tasks

The web technician schedule also reads dashboard agenda. It does not currently appear to create general `Task` items from the schedule page.

## Recommended Architecture

### Rule

Tasks should schedule or remind. Official forms should record permanent animal history.

### Task Type Mapping

| Technician intent | Store as Task? | Official form required to complete? | Final official record |
|---|---:|---:|---|
| General Visit | Yes | No | None |
| Follow-up Visit | Yes | No, unless linked to health/breeding | Optional linked source |
| Farm Inspection | Yes | No | None |
| Admin Reminder | Yes | No | None |
| Pickup / deliver supplies | Yes | No | None |
| Artificial Insemination | Yes as appointment | Yes | Insemination |
| Health Assistance / Treatment | Yes as appointment | Yes | HealthRequest / MedicalRecord |
| Pregnancy Check | Yes as appointment/PD task | Yes | Pregnancy |
| Calving / Calf Drop | Yes as appointment | Yes | Calving + offspring animals |
| Vaccination | Yes as appointment | Yes if health/medical records track vaccination | MedicalRecord or future Vaccination record |

## Recommended Schedule Visit Flow

1. Technician opens Client Profile.
2. Technician taps **Schedule Visit**.
3. App opens `create-task` with the farmer already selected.
4. Default task type is **General Visit**, not AI.
5. Technician chooses:
   - General Visit
   - Follow-up
   - Farm Inspection
   - Artificial Insemination
   - Health Assistance
   - Pregnancy Check
   - Calving
6. Technician selects due date / visit date.
7. Backend stores `taskType`, `dueDate`, `sourceType: "manual"`, `metadata.source: "client-profile"`.
8. Task appears in:
   - To-Do List
   - Calendar
   - Dashboard Agenda as a task/visit item
   - Client Profile Operational Activity
9. If the task type is official-service-related, the task detail primary button opens the official form.
10. After successful official form submission, backend marks the task completed and links it to the created official record.

## Backend Changes Needed

### Phase 1 Backend

- Update `createTask` to validate and persist:
  - `taskType`
  - `dueDate`
  - `sourceType`
  - `metadata`
  - `priority` if used
- Keep backward compatibility for existing tasks with missing `taskType`.
- Add aliases/mapping:
  - `General Visit` -> `Other` or new `GeneralVisit`
  - `Health` -> `Treatment` or new `Health`
  - `Calving` -> `CD`
  - `Pregnancy Check` -> `PD`
- Consider adding clearer task types:
  - `GeneralVisit`
  - `FarmInspection`
  - `Health`
  - `Calving`
- Add optional linking fields:
  - `relatedRecordType`
  - `relatedRecordId`
  - `completedAt`
- Add a safe completion rule:
  - General tasks can be completed directly.
  - Official-service task types should not be directly completed unless linked to an official record or explicitly completed with an allowed override reason.
- Add or update dashboard agenda logic so generic tasks with `dueDate` are included.
- Add client activity logic so generic tasks appear as operational activity without mixing them into official service history.

### Phase 1 Backend Tests

- Creating a general visit persists `taskType`, `dueDate`, `sourceType`, and metadata.
- Creating an AI task does not create an Insemination record immediately.
- Completing a general task works.
- Completing an AI/Health/PD/CD task directly is blocked or requires a linked official record.
- Calendar/dashboard endpoint includes scheduled generic tasks.
- Client profile endpoint includes generic tasks as operational activity.

## Mobile Changes Needed

### Phase 1 Mobile

- Keep the Client Profile Schedule Visit quick action and route params unchanged.
- Change `create-task` default `serviceType` from `AI` to `General Visit` when no `type` param is supplied.
- Add service type options:
  - General Visit
  - Follow-up
  - Farm Inspection
  - Artificial Insemination
  - Health Assistance
  - Pregnancy Check
  - Calving
- Add a visit date / due date field.
- Do not ask for sire breed, sire code, diagnosis, treatment, or medicine inside the task form.
- For general tasks, allow optional animal selection.
- For official-service tasks, allow animal selection but still collect final service details only in the official form.
- Update task detail primary actions:
  - General Visit / Follow-up / Farm Inspection -> `Mark as Completed`
  - AI -> `Record AI Service`
  - Health -> `Record Health Service`
  - PD -> `Verify Pregnancy Observation`
  - CD/Calving -> `Record Calving`
- Pass task context to official forms:
  - `taskId`
  - `farmerId`
  - `animalId`
  - `source: "task"`
- Update `useAnimalContext` or each official form to understand `taskId`.
- After official form success, call a backend endpoint to complete/link the task.

## Web Changes Needed

- Keep web technician request and schedule pages using official workflow APIs for AI and Health requests.
- Include generic scheduled tasks in web Schedule if backend adds them to `agendaItems`.
- Ensure `TaskActionModal` follows the same rule:
  - General task -> mark complete.
  - Official service task -> open or direct user to official service workflow.
- Avoid creating official service records from plain task notes.

## Migration And Backward Compatibility Plan

- Existing tasks with missing `taskType` should display as `Other` or `General Visit`.
- Existing tasks with notes starting `[AI RECORD]`, `[HEALTH CHECK]`, or `[VACCINATION]` should not be automatically converted without review.
- Add a future admin/technician review screen for legacy task notes that may need conversion to official records.
- Do not delete old tasks.
- Do not create automatic official records from legacy task notes because that could duplicate records or invent clinical/breeding history.

## Risks

- Auto-converting old task notes could create false official records.
- Letting official-service tasks be directly completed would hide missing animal history.
- Adding generic tasks into agenda without a clear `type` may confuse web/mobile schedule UI.
- Changing task type enums without aliases can break old tasks.
- Vaccination needs a clear official record destination before it is treated like a clinical history item.

## Phase 1 Implementation Plan

### Goal

Make task scheduling safe without redesigning UI or changing the request queue workflow.

### Backend Phase 1

1. Persist `taskType`, `dueDate`, `sourceType`, and `metadata` in `POST /api/tasks`.
2. Validate task type with aliases so old and new labels do not break.
3. Add optional `relatedRecordType`, `relatedRecordId`, and `completedAt` to `Task`.
4. Update `PUT /api/tasks/:id/complete`:
   - allow direct completion for general task types
   - block official-service task types unless linked to an official record
5. Add a task-link completion endpoint or extend completion payload:
   - `relatedRecordType`
   - `relatedRecordId`
6. Add generic scheduled tasks to `dashboard-data?fullAgenda=true`.
7. Add generic scheduled tasks to client profile operational activity.

### Mobile Phase 1

1. Update `create-task` to be a visit/task scheduler, not an official record form.
2. Preserve all Client Profile route params.
3. Default Schedule Visit to General Visit.
4. Add visit date selection.
5. Make animal selection optional for general tasks.
6. Update task detail buttons by task type.
7. Pass `taskId`, `farmerId`, `animalId`, and `source: "task"` to official forms.
8. Update official forms to complete/link the task after successful record creation.
9. Keep PD redirect behavior working.

### Web Phase 1

1. Display generic scheduled tasks in web Schedule after backend agenda support is added.
2. Do not allow official-service tasks to be treated as plain completed checklist items.
3. Keep web request queue using `/api/technician/requests`.

## Acceptance Criteria

- Schedule Visit from Client Profile still opens `create-task`.
- Farmer context is still prefilled.
- A general visit task can be created without animal selection.
- A scheduled visit has a date and appears in To-Do List and Calendar.
- AI/Health/Pregnancy/Calving tasks do not store final service details only in `Task.notes`.
- AI task opens Record AI form.
- Health task opens Health Log form.
- PD task keeps existing Pregnancy Verification flow.
- Calving task opens Record Calving form.
- Official form success marks the originating task completed and links it.
- Existing tasks still display safely.

## Final Recommendation

The current Schedule Visit quick action should stay. The route params are useful and mostly correct.

The fix is not to remove it, but to make `create-task` a true scheduler:

- Default to **General Visit**.
- Persist task type and due date.
- Show scheduled tasks in calendar/agenda.
- Treat AI, Health, Pregnancy Check, and Calving tasks as appointments that must be completed through official service forms.

This keeps the technician workflow simple while protecting animal history, reports, and breeding/health records from being trapped in plain text task notes.
