# BreedSmart Record AI Flow Cleanup Plan

Date: 2026-06-30

Target folders:

- `mobile_2.0`
- `backend_2.0`

Do not modify:

- `mobile`
- `backend`

## Goal

Make the technician **Record AI** flow reliable for both:

- existing AI request completion/scheduling
- walk-in/manual AI recording

The most important fix is that the automatic scheduled PD follow-up must count from the **actual insemination date selected by the technician**, not always from the current day.

## Current Behavior

The mobile screen is:

- `mobile_2.0/app/(technician)/record-ai.tsx`

It supports:

- selecting an existing farmer
- registering a new farmer
- selecting an existing animal
- registering a new animal for the selected farmer
- choosing AI service mode:
  - Complete
  - Schedule
- selecting AI date and time
- selecting sire breed
- auto-setting sire code from sire registry
- selecting estrus type
- adding notes

The backend walk-in endpoint is:

- `POST /api/technician/walk-in-insemination`

The existing AI request update endpoint is:

- `PATCH /api/technician/inseminations/:id/status`

## Key Problem

Walk-in AI correctly sends and saves the selected `inseminationDate` and `time`.

Existing AI request completion does not.

When completing an existing AI request, the mobile screen currently sends the selected date as `scheduledDate`. The backend then overwrites `inseminationDate` with `new Date()` when `status === "done"`.

That means:

- technician selects AI date 30 days ago
- backend saves insemination date as today
- automatic PD follow-up becomes due 60 days from today
- expected countdown is wrong

## Correct Behavior

If technician records AI as completed with an AI date 30 days ago:

- `inseminationDate` should be 30 days ago
- automatic PD follow-up should be due 30 days from now
- technician queue should not show it yet unless `includeUpcoming=true`

If technician schedules AI for a future date:

- save `scheduledDate`
- do not set `inseminationDate`
- do not create automatic PD follow-up yet
- do not set animal reproductive status to `Inseminated` yet

## Desired User Flow

```text
Record AI
  |
  |-- Existing AI Request?
  |       |
  |       |-- Farmer/Animal locked
  |       |-- Fill AI details
  |       |-- Schedule or Complete
  |
  |-- Walk-in Record?
          |
          |-- Select Farmer
          |       |-- Existing Farmer
          |       |-- Register New Farmer
          |
          |-- Select Animal
          |       |-- Existing Animal
          |       |-- Register New Animal
          |              |-- Use Generate Tag / Animal ID component
          |              |-- Species
          |              |-- Breed
          |              |-- Gender default Female
          |              |-- Ear tag / color
          |
          |-- Fill AI details
                  |-- Schedule
                  |      |-- save scheduledDate only
                  |
                  |-- Complete
                         |-- save inseminationDate
                         |-- set animal Inseminated
                         |-- create automatic PD follow-up
                         |-- dueDate = inseminationDate + 60 days
```

## Mobile Cleanup Plan

### 1. Preserve Existing Context Modes

The screen should keep supporting:

- locked context from animal profile
- request context through `requestId`
- walk-in context from dashboard quick action

Existing context hook:

- `mobile_2.0/hooks/useAnimalContext.ts`

### 2. Add Explicit Animal Registration Mode

Current risk:

The UI uses `newAnimal.animalId` to decide whether the screen is in “register new animal” mode.

This is fragile because a technician might only fill `earTag`, leaving `animalId` empty.

Add:

```ts
const [isRegisteringAnimal, setIsRegisteringAnimal] = useState(false);
```

Use this for UI mode switching instead of `newAnimal.animalId`.

Expected behavior:

- Tap `+ Register New for this Farmer`
  - set `isRegisteringAnimal(true)`
  - clear `selectedAnimal`
- Tap `Back to Selection`
  - set `isRegisteringAnimal(false)`
  - reset `newAnimal`

### 3. Use Existing Generate Tag Component

The app already has a component or utility for generating animal tags/IDs.

Use that inside the quick animal registration section.

Expected behavior:

- generated animal ID/tag is shown in the registration form
- technician can confirm or edit only if existing component allows it
- generated ID/tag is included in `animalDetails`

Do not create a second tag generation system.

### 4. Add Gender/Sex To Quick Animal Registration

Because AI is restricted to female animals, quick animal registration should include:

- sex/gender field
- default value: `Female`

For AI-specific quick registration, female default is appropriate.

If technician chooses Male, the UI should block AI save with a clear message.

### 5. Strengthen Mobile Validation

For both request completion and walk-in:

If `status === "done"`:

- farmer required unless locked context provides it
- animal required or valid new animal details required
- animal must be female
- sire breed required
- sire code required
- AI date/time cannot be in the future
- payload must include `inseminationDate`

If `status === "in-progress"` / Schedule:

- farmer required
- animal required or valid new animal details required
- schedule date/time cannot be in the past
- payload must include `scheduledDate`
- do not require pregnancy/PD logic

Sire breed/code policy:

- For Complete: required.
- For Schedule: optional or required depending current workflow. Prefer optional for scheduling, because semen details may be recorded during actual service.

### 6. Fix Existing Request Completion Payload

When `requestId` exists:

If Complete:

```ts
{
  status: "done",
  technicianNote: notes,
  sireBreed,
  sireCode,
  estrus,
  inseminationDate: combinedSelectedDateTime,
}
```

If Schedule:

```ts
{
  status: "in-progress" or "scheduled",
  technicianNote: notes,
  scheduledDate: combinedSelectedDateTime,
}
```

Use one combined date-time value from selected date and selected time.

Avoid sending a date-only value when time is available.

## Backend Cleanup Plan

### 1. Respect Selected Insemination Date

In:

- `backend_2.0/src/controllers/technician.controllers.js`

Update `updateInseminationStatus`.

Current issue:

```js
if (status === "done") {
  updateData.inseminationDate = new Date();
}
```

Desired:

```js
if (status === "done") {
  updateData.inseminationDate = req.body.inseminationDate
    ? new Date(req.body.inseminationDate)
    : new Date();
}
```

Also validate:

- completed AI date cannot be in the future
- scheduled date cannot be in the past

### 2. Check Sire Fields On Completion

When `status === "done"`:

- require `sireBreed`
- require `sireCode`
- require `estrus`

Return clear 400 errors if missing.

### 3. Preserve Automatic PD Follow-up Logic

Automatic PD task should continue to use:

- `sourceType: "automatic_pd_followup"`
- `dueDate = inseminationDate + 60 days`
- `metadata.inseminationId`

After backend respects selected `inseminationDate`, this countdown becomes reliable.

### 4. Prevent Cross-owner Animal Mistakes

Current risk:

Walk-in backend may find an existing animal by global `earTag` or `animalId`, even if that animal belongs to another farmer.

Desired behavior:

- if `animalId` or `earTag` exists under the same farmer, use it
- if it exists under another farmer, reject with clear message
- do not silently attach an AI record to another farmer’s animal

### 5. New Animal Defaults

When creating a new animal from Record AI:

- assign farmer ID from selected/created farmer
- set sex/gender to `Female` by default if omitted
- preserve generated animal ID/tag
- keep species, breed, color

## Test Scenarios

### Scenario 1: Walk-in AI Done Today

Expected:

- saves `inseminationDate` today
- animal becomes `Inseminated`
- automatic PD follow-up created
- PD due date is today + 60 days
- normal request queue does not show future PD task

### Scenario 2: Walk-in AI Done 30 Days Ago

Expected:

- saves `inseminationDate` 30 days ago
- PD due date is 30 days from now
- normal request queue does not show it yet
- `includeUpcoming=true` shows it

### Scenario 3: Existing AI Request Completed 30 Days Ago

Expected:

- backend respects selected `inseminationDate`
- PD due date is 30 days from now
- no false 60-day countdown from today

### Scenario 4: Existing AI Request Scheduled

Expected:

- saves `scheduledDate`
- does not set `inseminationDate`
- does not create PD task
- animal does not become `Inseminated`

### Scenario 5: Register New Animal For Existing Farmer

Expected:

- UI mode is controlled by `isRegisteringAnimal`
- generated tag component is used
- female default is applied
- animal is attached to selected farmer
- AI record saves normally

### Scenario 6: Duplicate Ear Tag Under Another Farmer

Expected:

- backend rejects with a clear message
- no AI record is created for wrong owner

## Verification Commands

Backend:

```bash
cd backend_2.0
npm test
npm run check
```

Mobile:

```bash
cd mobile_2.0
npx tsc --noEmit
npm run lint
