# BreedSmart Phase 2-5 Plan - Requests Board, My Work Queue, Location-Aware Claiming

## Antigravity Implementation Prompt

Act as a senior full-stack engineer working inside the existing BreedSmart repository.

Phase 1, the visible UI naming pass, is already done. Do not rename Expo Router files. Do not redesign the app from scratch. Continue using the current stack and patterns:

- Mobile: Expo Router, React Native, NativeWind, TanStack Query, existing theme/components.
- Backend: Express, MongoDB/Mongoose, Clerk auth, existing route/controller style.
- Preserve the rule: original route filenames stay stable unless explicitly requested later.

Your job is to implement Phases 2-5 of the Iloilo-wide technician work model:

```text
Farmer submits official service request
-> request enters Available Requests Board
-> nearby/available technician claims it
-> request moves to My Claimed Requests / My Work Queue
-> technician completes official service form
-> animal timeline, records, reports, and notifications remain official-source driven
```

Important architecture rule:

```text
Official farmer requests are not generic Tasks.
Generic Task records are for technician-created visits, reminders, appointments, and follow-ups.
AI / Health / Pregnancy / Calving records must be completed through official service forms.
```

Do not trap official service details in `Task.notes`.

---

## Current Completed Phase

### Phase 1: UI Naming + Navigation Clarity

Already implemented:

- Technician bottom nav: `Home | Farmers | + | Animals | Profile`.
- Records/Ledger moved into technician `+` quick actions.
- Visible labels updated:
  - Requests Board
  - My Work Queue
  - Schedule Farm Visit
  - Visit / Task Details
  - Health Assistance
  - AI Service Request
  - Report Health Concern
  - My Service Requests
  - Home / Contact Address
  - Farm Location

Do not redo Phase 1 unless fixing a missed label.

---

## Phase 2: Request Board Behavior

### Goal

Make the technician **Requests Board** truly support:

```text
Available Requests
My Claimed Requests
```

This phase is for official farmer-submitted requests:

- AI Service requests.
- Health Assistance requests.
- Pregnancy Verification requests, where represented by PD verification tasks linked to breeding observations.
- Calving Support requests, if an official request model already exists; otherwise leave as future-ready.

### Core Rule

Farmer-submitted AI and Health requests should remain official request records:

```text
AI request/insemination model
HealthRequest model
Pregnancy verification task linked to official breeding/insemination context
```

Do not convert these into generic `Task` records just to show them on the board.

### Backend Files To Inspect / Modify

- `backend/src/controllers/technician.controllers.js`
- `backend/src/routes/technician.routes.js`
- `backend/src/controllers/ai-request.controllers.js`
- `backend/src/controllers/health-request.controllers.js`
- `backend/src/models/insemination.model.js`
- `backend/src/models/health-request.model.js`
- `backend/src/models/task.model.js`

### Existing API To Build Around

Current technician request board is based on:

```http
GET /api/technician/requests
```

Extend this endpoint rather than creating a duplicate board endpoint unless there is a strong reason.

### Backend Request Board Requirements

Add or confirm support for these filters:

```text
assignment=available
assignment=mine
assignment=all
type=all | ai | health | breeding_verification | calving
status=all | pending | approved | scheduled | in_progress | completed | declined
urgency=all | urgent | emergency
page
limit
search
municipality
barangay
nearLat
nearLng
sortBy
sortOrder
```

Expected behavior:

- `assignment=available`
  - AI requests where no technician has claimed/approved/handled them yet.
  - Health requests where no technician has claimed/handled them yet.
  - Pregnancy verification items that are unassigned, if represented by task records.

- `assignment=mine`
  - AI requests assigned to current technician.
  - Health requests assigned/handled by current technician.
  - PD verification tasks assigned to current technician.

- `assignment=all`
  - Allowed for technician/admin visibility where policy permits.
  - Do not leak unnecessary private fields for unclaimed requests.

### Claim / Assign Behavior

Use the existing workflow endpoints where possible, but make the user-facing action consistently mean **Claim**.

For AI:

- Claiming an available AI request should assign it to the current technician.
- Use or add an endpoint that atomically updates only if it is still unclaimed.
- Do not allow two technicians to claim the same AI request.

For Health:

- Claiming an available Health Assistance request should assign or handle it by current technician.
- Use or add an endpoint that atomically updates only if it is still unclaimed.
- Emergency/urgent health cases should stay visible/high priority, but only one technician owns the claimed work.

For Pregnancy Verification:

- If it is backed by `Task`, implement task claim only for linked PD verification tasks.
- Do not make all generic tasks part of farmer Requests Board unless clearly separated.

### Atomic Claim Requirement

Every claim must be atomic:

```js
findOneAndUpdate(
  {
    _id,
    status: { $in: ["pending", "triaged", "approved"] },
    assignedField: { $in: [null, undefined] }
  },
  {
    assignedField: req.user._id,
    claimedAt: new Date(),
    status: nextStatus
  },
  { new: true }
)
```

If no document is updated, return:

```json
{
  "message": "This request has already been claimed by another technician.",
  "code": "REQUEST_ALREADY_CLAIMED"
}
```

Use the actual assignment fields already present in each model:

- AI may use `approvedBy`, `technicianId`, or similar current field.
- Health may use `handledBy`, `assignedTechnicianId`, or similar current field.
- PD verification task uses `technicianId`.

Do not invent new fields if existing fields already represent assignment, unless the existing model truly lacks them.

### Mobile Files To Inspect / Modify

- `mobile/features/technician-requests/screens/TechnicianRequestsScreen.tsx`
- `mobile/features/technician-requests/hooks/useTechnicianRequests.ts`
- `mobile/features/technician-requests/services/technicianRequests.service.ts`
- `mobile/features/technician-requests/components/RequestListCard.tsx`
- `mobile/app/(technician)/request-details.tsx`
- `mobile/app/(technician)/task-details.tsx`

### Mobile UI Requirements

In `TechnicianRequestsScreen`:

- Keep current route file.
- Header remains **Requests Board**.
- Add or refine segments:

```text
Available Requests
My Claimed Requests
```

- Use backend `assignment` filter, not only client filtering.
- Keep type filters:

```text
All
AI Service
Health Assistance
Pregnancy Verification
Calving Support
```

- Pending available items should show button:

```text
Claim
```

- Claimed/mine items should show:

```text
Open
Schedule
Start
Resolve
Complete
```

depending on workflow state.

### Request Detail UI Requirements

Before claim:

- Show limited info:
  - request type
  - urgency
  - animal ID / ear tag
  - municipality and barangay
  - approximate distance if available
  - preferred date
- Hide or reduce sensitive info if appropriate:
  - phone number
  - exact farm pin
  - directions note

After claim:

- Show full work details:
  - farmer phone
  - exact farm pin if available
  - landmark
  - directions note
  - official service action button

### Phase 2 Acceptance Criteria

- Technician can open Requests Board and switch between Available Requests and My Claimed Requests.
- Available AI request can be claimed by one technician only.
- Available Health Assistance request can be claimed by one technician only.
- A second technician attempting to claim gets a clear already-claimed message.
- Claimed requests move to My Claimed Requests.
- No official service details are stored only in generic task notes.

### Phase 2 Tests

Backend tests should cover:

- Technician can claim unassigned AI request.
- Technician can claim unassigned Health request.
- Farmer cannot claim technician request.
- Second technician cannot claim already-claimed request.
- `assignment=available` excludes claimed requests.
- `assignment=mine` returns only current technician work.

Mobile verification:

- Requests Board loads.
- Filters work.
- Claim button works.
- Claim state refreshes without requiring app restart.

---

## Phase 3: My Work Queue Clarity

### Goal

Make **My Work Queue** the technician's personal work hub:

```text
claimed official requests
scheduled farm visits
follow-ups
PD verification tasks
generic tasks
```

### Backend Files To Inspect / Modify

- `backend/src/controllers/tasks.controllers.js`
- `backend/src/routes/tasks.routes.js`
- `backend/src/models/task.model.js`
- `backend/src/controllers/technician.controllers.js`

### Task Scope Requirement

Update `GET /api/tasks` to support:

```text
scope=mine
scope=available
scope=all
```

Recommended behavior:

- `scope=mine`
  - `technicianId === req.user._id`
  - active tasks only unless status specified.

- `scope=available`
  - unassigned generic tasks only.
  - Use carefully; this is not the official Requests Board.

- no scope
  - preserve backward-compatible current behavior if needed.

### Optional Generic Task Claim

Implement only if needed after official request claiming is stable:

```http
PUT /api/tasks/:id/claim
```

Task claim must be atomic:

```js
Task.findOneAndUpdate(
  {
    _id: id,
    technicianId: { $in: [null, undefined] },
    status: "Pending"
  },
  {
    technicianId: req.user._id,
    status: "Pending",
    "metadata.claimedAt": new Date()
  },
  { new: true }
)
```

Do not change status to `In Progress` on claim. Claim means assigned, not started.

### Mobile Files To Inspect / Modify

- `mobile/app/(technician)/technician.tasks.tsx`
- `mobile/app/(technician)/task-details.tsx`
- `mobile/features/technician/services/tasks.service.ts`
- `mobile/features/technician/hooks/useTechnicianTasks.ts`
- `mobile/features/technician-dashboard/components/TechnicianRouteSection.tsx`
- `mobile/app/(technician)/technician.calendar.tsx`

### Mobile UI Requirements

In `technician.tasks.tsx`:

- Keep route file.
- Header stays **My Work Queue**.
- Replace direct raw API calls with existing technician task service/hook if feasible.
- Add segments:

```text
Today
Upcoming
Follow-up
Completed
```

or, if less risky:

```text
My Queue
Available Tasks
```

plus category chips:

```text
Urgent
Routine
Follow-up
Emergency
```

Cards should distinguish:

```text
Official request
Scheduled visit
Follow-up
General task
```

### Task Detail Requirements

In `task-details.tsx`:

- Header: **Visit / Task Details**.
- Generic task:
  - Show Complete General Visit.
- Official service task:
  - Show official form button:
    - Record AI Service
    - Record Health Assistance
    - Record Pregnancy Check
    - Record Calving / Offspring
- Unassigned generic task, if available-task mode exists:
  - Hide contact details if needed.
  - Show Claim Task.

### Dashboard / Calendar Requirements

Ensure claimed/scheduled tasks appear in:

- Technician Home `Today’s Visits`.
- Technician Calendar.
- Client/Farmer profile recent activity where appropriate.

Do not mix generic task completion into official animal history unless a linked official record exists.

### Phase 3 Acceptance Criteria

- My Work Queue clearly shows technician-owned work.
- Generic visits and official service work are visually distinguishable.
- Official service tasks open the correct official form.
- Completing a general visit does not create fake AI/health records.
- Calendar and Today’s Visits include scheduled tasks with due dates.

### Phase 3 Tests

Backend:

- `GET /api/tasks?scope=mine` returns only current technician tasks.
- `GET /api/tasks?scope=available` returns unassigned tasks.
- Generic task completion works.
- Official service task completion without related official record is rejected.

Mobile:

- My Work Queue loads.
- Task Details opens.
- Official buttons route correctly.
- General visit completion works.

---

## Phase 4: Location-Aware Requests

### Goal

Support all municipalities in Iloilo by helping technicians find nearby requests without requiring admin-assigned barangay zones.

### Current Location Model

Farmer profile already distinguishes:

```text
Home / Contact Address
Farm Location
```

Farm Location is the technician navigation target.

### Backend Files To Inspect / Modify

- `backend/src/models/user.model.js`
- `backend/src/controllers/technician.controllers.js`
- `backend/src/controllers/tasks.controllers.js`
- `backend/src/controllers/ai-request.controllers.js`
- `backend/src/controllers/health-request.controllers.js`

### Mobile Files To Inspect / Modify

- `mobile/features/technician-requests/screens/TechnicianRequestsScreen.tsx`
- `mobile/features/technician-requests/components/RequestListCard.tsx`
- `mobile/features/technician-requests/services/technicianRequests.service.ts`
- `mobile/features/technician-dashboard/components/TechnicianRouteSection.tsx`
- `mobile/app/(technician)/task-details.tsx`
- `mobile/app/(technician)/request-details.tsx`

### Distance Calculation

No Google Maps API is required.

Use Haversine formula with:

```text
technician current latitude/longitude
farmer farmLocation latitude/longitude
```

If farmer farm pin is missing:

```text
Distance unavailable
Farm pin missing
```

Fallback display:

```text
Barangay, Municipality
```

### Technician Current Location

Mobile should request foreground location permission only when needed:

- When technician taps Near Me.
- Or when technician enables location sorting.

Do not constantly track background location.

### Request Board Location UI

Cards should show:

```text
Municipality, Barangay
2.4 km away
Farm pin available
```

or:

```text
Oton, Iloilo
Distance unavailable
Farm pin missing
```

Sorting options:

```text
Emergency first
Nearest first
Preferred date
Oldest pending
```

### Privacy Rule

Before claim:

- show municipality/barangay and approximate distance.
- avoid showing exact farm directions/contact if policy requires.

After claim:

- show full contact and navigation details.

### Phase 4 Acceptance Criteria

- Technician can sort/filter by nearby requests.
- Requests with farm pins show distance.
- Requests without farm pins show clear fallback.
- App does not require Google Maps API for distance.
- Exact farm details are only fully exposed after claim if privacy policy requires that behavior.

### Phase 4 Tests

Backend:

- Distance fields are correct if nearLat/nearLng provided.
- Requests without farmLocation do not crash sorting.

Mobile:

- Location permission denied state is handled.
- Near Me sorting works.
- Missing farm pin indicator is visible.

---

## Phase 5: Route/File Cleanup Later

### Goal

Only after Phases 2-4 are stable, optionally rename route files and feature folders to match the new wording.

### Important Warning

Do not start Phase 5 until:

- Requests Board claim flow is stable.
- My Work Queue is stable.
- Location-aware board is stable.
- Client has accepted the new labels.

Expo Router file renames can break navigation if done too early.

### Candidate Route Renames

Technician:

| Current File | Future Name |
|---|---|
| `mobile/app/(technician)/requests.tsx` | `requests-board.tsx` |
| `mobile/app/(technician)/technician.tasks.tsx` | `my-work-queue.tsx` |
| `mobile/app/(technician)/create-task.tsx` | `schedule-farm-visit.tsx` |
| `mobile/app/(technician)/task-details.tsx` | `visit-task-details.tsx` |
| `mobile/app/(technician)/client.profile.tsx` | `farmer-profile.tsx` |
| `mobile/app/(technician)/register-client.tsx` | `register-farmer.tsx` |
| `mobile/app/(technician)/health-log.tsx` | `record-health-assistance.tsx` |
| `mobile/app/(technician)/record-calf-drop.tsx` | `record-calving.tsx` |

Farmer:

| Current File | Future Name |
|---|---|
| `mobile/app/(farmer)/(tabs)/add-animal.tsx` | `my-animals.tsx` |
| `mobile/app/(farmer)/my-requests.tsx` | `my-service-requests.tsx` |
| `mobile/app/(farmer)/report-sickness/index.tsx` | `report-health-concern/index.tsx` |
| `mobile/app/(farmer)/animal-details.tsx` | `animal-profile.tsx` |

### Route Rename Safety Steps

For each route rename:

1. Search all `router.push`, `router.navigate`, `pathname`, and deep links.
2. Update route references.
3. Keep temporary redirect wrapper if needed.
4. Run TypeScript.
5. Run mobile navigation smoke test.
6. Test from bottom nav, quick actions, dashboard cards, notification links.

### Phase 5 Acceptance Criteria

- No broken route navigation.
- Old deep links either redirect or are intentionally removed.
- Expo Router builds without route errors.
- User-visible names and filenames are aligned.

---

## Do Not Do

- Do not rename files during Phases 2-4.
- Do not create a separate veterinarian dashboard.
- Do not convert official AI/Health/Pregnancy/Calving records into generic tasks.
- Do not store final service details only in `Task.notes`.
- Do not require Google Maps API for distance sorting.
- Do not show exact farm directions/contact before claim unless current privacy policy allows it.
- Do not break the original familiar navigation structure.

---

## Global Verification Command Checklist

Run after each phase:

```bash
cd backend
npm test
```

```bash
cd mobile
npx tsc --noEmit
npm run lint
```

Manual mobile testing:

- Technician login.
- Requests Board.
- Available Requests.
- My Claimed Requests.
- Claim request.
- My Work Queue.
- Visit / Task Details.
- Official form routing.
- Today’s Visits.
- Visit Calendar.
- Farmer profile and animal profile context links.

---

## Final Product Mental Model

The app should communicate this clearly:

```text
Requests Board = work farmers are asking for.
Claim = I accept this work.
My Work Queue = work assigned to me.
Schedule Farm Visit = create a visit/task/reminder.
Records / Ledger = official service history and reports.
Farm Location = where the technician should go.
Home / Contact Address = where the farmer lives or can be contacted.
```

