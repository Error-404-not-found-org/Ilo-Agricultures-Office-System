# Workflow and Offline Consolidation Plan

Date: 2026-07-11

## Purpose

BreedSmart now has stronger transaction services, lifecycle rules, offline support, and regression tests. However, some older routes and mobile hooks still perform the same operations independently.

The next phase should consolidate these implementations before adding more record features.

The target architecture is:

```text
Different farmer and technician screens
                ↓
Shared canonical workflow operation
                ↓
One transaction-safe database-writing path
```

Farmer and technician interfaces may remain different. Their underlying data-changing operations should be shared.

## Current Validation Baseline

At the time of this audit:

- Backend: 57 tests passed.
- Web: lint passed and 8 tests passed.
- Mobile: TypeScript check passed.

These results confirm that the current code compiles and its existing tests pass. They do not prove that duplicate routes have identical validation and side effects.

## Critical Findings

### 1. Two AI status implementations

Canonical endpoint:

```text
PATCH /api/ai-request/:id/status
```

Legacy endpoint:

```text
PATCH /api/technician/inseminations/:id/status
```

The canonical implementation includes centralized transition validation, scheduling requirements, assignment protection, schedule-conflict checks, and transactional AI completion.

The legacy technician implementation performs direct updates with a different validation and side-effect path.

Current mobile references to the legacy endpoint include:

- `mobile/features/technician/services/technician.service.ts`
- `mobile/features/technician/hooks/useTechnicianDashboard.ts`

#### Migration rule

Do not immediately delete the legacy route.

Installed mobile versions and pending offline queue entries may still reference it. Use this sequence:

1. Make the legacy endpoint delegate to the canonical implementation.
2. Update current mobile calls to `/ai-request/:id/status`.
3. Migrate queued legacy URLs where practical.
4. Keep the legacy route as a temporary compatibility alias.
5. Remove it only after the supported old-client and offline-queue window has expired.

### 2. Pregnancy diagnosis is duplicated

The shared transaction service already exports:

```text
persistPregnancyDiagnosis
```

The technician pregnancy-check controller still independently:

1. Creates the pregnancy record.
2. Updates the insemination outcome.
3. Updates the animal reproductive status.

This can leave inconsistent data if one write succeeds and a later write fails.

#### Target

Keep the existing technician route for compatibility, but make its controller call `persistPregnancyDiagnosis`.

The route may remain role-specific. The database-writing implementation must be shared.

### 3. Calving is duplicated

The general animal controller uses:

```text
persistCalving
```

The technician controller still independently handles offspring creation, animal registration, calving creation, mother updates, pregnancy updates, audit records, and related effects.

The two paths can disagree on validation, offspring ownership, mother status, pregnancy completion, and duplicate handling.

#### Target

Make both farmer/general and technician calving entry points call `persistCalving`.

Controllers may retain role-specific response formatting, notifications, socket events, and navigation data.

### 4. AI completion performs redundant writes

The canonical AI controller calls `completeInsemination`, which transactionally updates the official AI record and animal status.

Afterward, the controller updates the animal to `Inseminated` again and also creates/checks the pregnancy-diagnosis follow-up task while background automation is triggered for the same event.

#### Target

- Keep official AI state changes inside `completeInsemination`.
- Remove repeated animal writes from the controller.
- Assign pregnancy-diagnosis follow-up creation to one owner.
- Use a unique database constraint or equivalent durable guard for follow-up creation.

Preferred responsibility split:

```text
Transaction service → official AI and animal state
Durable background event → reminders and follow-up tasks
Controller → authorization, notifications, sockets, response
```

### 5. Health resolution writes the medical record twice

`resolveHealthRequest` already transactionally creates or upserts the related medical record.

The health controller performs another `MedicalRecord.updateOne` afterward. A unique sparse index on `healthRequestId` prevents duplicate documents, but two separate record definitions remain in the code.

#### Target

The transaction service should be the only medical-record writer for health resolution.

The controller should retain notifications, withdrawal alerts, sockets, background events, and response formatting without writing the medical record again.

### 6. Livestock statuses are distributed

Status and result values currently appear in:

- `backend/src/domain/reproduction-lifecycle.js`
- `backend/src/domain/livestock-workflow.js`
- Backend controllers
- Inngest jobs
- Mobile eligibility checks
- Mobile UI display conditions

The two domain files have different responsibilities and may coexist:

- `reproduction-lifecycle.js`: biological eligibility and timing rules.
- `livestock-workflow.js`: software workflow transition rules.

#### Target

Create one shared backend vocabulary for:

```text
Animal reproductive statuses
AI request statuses
Health request statuses
Pregnancy results
Task statuses
Calving workflow states
```

Both domain modules should consume that vocabulary. Controllers and Inngest jobs should gradually replace raw status strings.

Mobile may have display-label mappings, but API values should remain canonical.

### 7. Offline handling has multiple implementations

The reusable `useOfflineMutation` supports refreshed connectivity detection, request timeout, network-failure fallback, idempotency, temporary IDs, queued results, and user feedback.

Some technician hooks still manually repeat:

- `NetInfo.fetch()`
- Connectivity checks
- `addToOfflineQueue()`
- Temporary queued-result construction

Known locations include:

- `mobile/features/technician-requests/hooks/useTechnicianRequests.ts`
- `mobile/features/technician/hooks/useTechnicianDashboard.ts`
- `mobile/features/technician/hooks/useTechnicianTasks.ts`

#### Target

Create one non-React executor:

```text
executeOfflineMutation()
```

Then:

- `useOfflineMutation` wraps the executor for React Query forms.
- Other technician hooks call the same executor.
- All mutations share timeout, idempotency, connectivity, file persistence, temporary-ID, and queued-response behavior.

### 8. Offline queue types are duplicated

The active queue engine defines `QueuedMutation` in:

```text
mobile/lib/offlineQueue.ts
```

Other definitions include:

```text
mobile/types/index.ts → OfflineMutation
mobile/features/offline-sync/types/offlineQueue.types.ts → OfflineQueueItem
```

The older type uses `createdAt`, while the active engine uses `timestamp`. The older type also omits newer fields such as:

- `payloadVersion`
- `filePaths`
- `tempId`
- `entityType`
- `dependsOn`
- `resultServerId`

#### Target

Use the queue-engine type as the single source of truth.

Other modules should import or re-export it rather than maintain another handwritten interface.

Example target:

```ts
export type { QueuedMutation as OfflineQueueItem } from "@/lib/offlineQueue";
```

### 9. Mobile technician feature ownership is unclear

Related functionality exists across:

```text
features/technician
features/technician-clients
features/technician-dashboard
features/technician-records
features/technician-requests
features/technician-animals
```

Some modules are complementary, but older general technician services coexist with newer focused feature services.

#### Target

Do not reorganize folders first.

Use this sequence:

1. Map every active screen to its imported hook and service.
2. Declare the focused feature module as the owner.
3. Redirect imports to the owner.
4. Run TypeScript and functional tests.
5. Remove legacy modules only after they have no consumers.

## Revised Roadmap

## Phase 1.5: Workflow Consolidation and Regression Repair

Priority order:

1. Make technician pregnancy check use `persistPregnancyDiagnosis`.
2. Make technician calving use `persistCalving`.
3. Remove the second health-resolution medical-record write.
4. Make the legacy AI status endpoint delegate to the canonical implementation.
5. Update current mobile AI actions to `/ai-request/:id/status`.
6. Remove redundant animal writes after `completeInsemination`.
7. Assign PD follow-up creation to one durable owner.
8. Add route-level regression tests for every canonical workflow.

### Phase 1.5 acceptance criteria

- Each official operation has one database-writing implementation.
- Pregnancy, AI, health, and calving multi-document writes are transaction-safe.
- Legacy routes act only as compatibility adapters.
- Old queued mobile operations remain processable.
- Retrying a request does not create duplicate official records.
- Notifications and socket events occur only after successful official writes.

## Phase 2.5: Domain Vocabulary Unification

1. Define canonical status and result constants.
2. Make lifecycle and workflow modules consume those constants.
3. Replace raw status strings in canonical controllers.
4. Replace raw status strings in Inngest jobs.
5. Map canonical API values to human-readable mobile and web labels.
6. Add tests for allowed and rejected transitions.

### Phase 2.5 acceptance criteria

- No canonical workflow invents a new raw status value.
- Mobile and web interpret the same API status identically.
- Eligibility rules and workflow transition rules remain separate modules.
- Unknown or deprecated statuses fail visibly rather than silently falling through.

## Phase 3.5: Offline Consolidation

1. Extract `executeOfflineMutation` beneath the React hook.
2. Move technician manual queue wrappers to the executor.
3. Make `QueuedMutation` the canonical queue type.
4. Re-export the canonical type where feature-specific names are useful.
5. Preserve idempotency keys during fallback and retry.
6. Preserve file paths, temporary IDs, dependencies, and server-ID mappings.
7. Add optimistic temporary records only when the active UI renders them.
8. Add tests for queue dependency ordering and legacy URL migration.

### Phase 3.5 acceptance criteria

- All offline-capable mutations use one executor.
- Expo Go offline submission stops loading and queues promptly.
- Each queued mutation synchronizes at most once.
- Dependent records resolve temporary IDs before upload.
- Installed older clients and existing queues remain compatible during migration.
- Queue history and Sync Center use the canonical queue shape.

## Later Phases

After consolidation:

1. Role and session unification.
2. Pagination and list-performance improvements.
3. API response consistency.
4. Realtime and push-notification reliability.
5. Security and production operations.
6. Mobile feature ownership and folder cleanup.
7. Unified web/mobile animal-record presentation.
8. End-to-end release testing.

## Required Regression Tests

Add route-level tests for:

### AI

- Invalid transition is rejected.
- AI cannot start before scheduling.
- Completion writes AI and animal state atomically.
- Retry with the same idempotency key does not duplicate side effects.
- Legacy compatibility endpoint produces the canonical result.
- PD follow-up task is created once.

### Pregnancy

- Insemination must belong to the selected animal.
- Duplicate diagnosis for one AI attempt is rejected.
- Pregnancy, insemination, and animal update in one transaction.
- Negative diagnosis uses the canonical animal status.
- Failed transaction leaves all three records unchanged.

### Calving

- Pregnancy must belong to the mother.
- Declared calf count must match offspring input.
- Mother, pregnancy, calving, and offspring commit together.
- Retry cannot duplicate offspring or calving.
- Farmer and technician entry points produce equivalent official data.

### Health

- Resolution creates exactly one medical record.
- Medical record links to the health request.
- Withdrawal dates are calculated once from the correct service date.
- Failed transaction leaves request and medical history unchanged.

### Offline

- No connection queues without waiting indefinitely.
- Network timeout falls back to the queue.
- HTTP validation errors are not queued.
- Original idempotency key survives network fallback.
- Temporary references resolve in dependency order.
- Legacy queued AI URLs remain processable during migration.

## Safety Rules

- Do not delete legacy routes before current mobile calls and queued mutations are migrated.
- Do not remove old mobile services until import analysis proves they have no consumers.
- Do not combine biological eligibility and workflow transitions into one large domain module.
- Do not create notifications before the official transaction commits.
- Do not perform the same official-record write in both a transaction service and controller.
- Do not add new record features while canonical workflow consolidation is incomplete.
- Preserve existing route parameters and user-facing workflows during internal consolidation.

## Definition of Done

Consolidation is complete when:

- AI completion has one authoritative writer.
- Pregnancy diagnosis has one authoritative writer.
- Calving has one authoritative writer.
- Health resolution has one authoritative medical-record writer.
- All canonical workflows use centralized status vocabulary.
- All offline-capable technician mutations use one executor.
- The mobile app uses one canonical offline queue type.
- Legacy endpoints are compatibility adapters only.
- Route-level regression tests cover canonical and compatibility paths.
- Backend tests, web lint/tests, and mobile TypeScript checks pass.
- Expo Go offline registration and service recording pass manual testing.

## Recommended Next Action

Begin with Phase 1.5, starting with pregnancy and calving transaction consolidation. These operations modify several related records and carry the highest risk of partial or inconsistent animal histories.

## Implementation Progress

### Phase 1.5 core consolidation completed on 2026-07-11

- Technician pregnancy check now calls `persistPregnancyDiagnosis`.
- Technician calving now calls `persistCalving`.
- Health resolution no longer performs a second medical-record upsert.
- The legacy technician AI status route delegates to the canonical AI controller.
- Current mobile technician AI status calls use `/ai-request/:id/status`.
- The legacy AI URL remains available for installed clients and queued offline mutations.
- Canonical AI completion no longer repeats the animal-status and PD-task writes already committed by `completeInsemination`.
- Workflow-consolidation regression tests were added.

Verification after this implementation:

- Backend: 62 tests passed.
- Web: lint, 8 tests, and production build passed.
- Mobile: TypeScript check passed.

Remaining consolidation work:

- Remove the now-unrouted legacy `updateInseminationStatus` controller implementation after confirming no direct imports remain.
- Add behavioral route tests that exercise canonical and compatibility AI URLs with equivalent responses.
- Continue Phase 2.5 status-vocabulary unification.
- Continue Phase 3.5 offline executor and queue-type consolidation.
