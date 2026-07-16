# Mobile Offline Mutation Inventory

Verified: 2026-07-12

## Queue-Capable Creation Workflows

| Workflow | Active implementation | Endpoint | Entity type / dependency notes |
|---|---|---|---|
| Technician register farmer | `(technician)/register-client.tsx` | `POST /technician/register-farmer` | Creates a temporary farmer ID when queued; form returns immediately |
| Technician register animal | `(technician)/register-animal.tsx` | animal registration endpoint | Temporary animal ID; may depend on a temporary farmer ID when selected from optimistic data |
| Shared add animal | `(forms)/clients/add-animal.tsx` | animal registration endpoint | Uses shared offline mutation hook |
| Farmer request AI | `(farmer)/request-ai/index.tsx` | `POST /ai-request` | Depends on an existing animal ID |
| Farmer request health service | `features/farmer-requests` | `POST /health-request` | Depends on an existing animal ID |
| Technician record AI | `features/technician/useTechnicianFieldRecords` and active record screen | `POST /technician/walk-in-insemination` | Depends on farmer and animal IDs |
| Technician record health | `(technician)/health-log.tsx` | walk-in/request health endpoints | Depends on farmer and animal IDs; attachments are cached as files |
| Technician record pregnancy | technician field-record hook / active form | `POST /technician/pregnancy-check` | Depends on animal, insemination, and optional task IDs |
| Technician record calving | `(technician)/record-calf-drop.tsx` | `POST /technician/record-calving` | Depends on mother, pregnancy, and optional task IDs; calf images are cached |
| Farmer record calving | `(farmer)/record-calving.tsx` | farmer calving endpoint | Depends on mother and pregnancy IDs |

## Queue-Capable Operational Mutations

- Claim and decline technician requests.
- Create, claim, and complete supported tasks.
- Update technician request status through the shared executor where migrated.

## Queue Guarantees Present

- Stable idempotency key for online request and offline retry.
- Serialized queue writes.
- Temporary ID extraction and server-ID mapping.
- Automatic dependency inference from temporary IDs in URL or payload.
- Dependency ordering and failure propagation.
- Base64 attachment persistence to device files.
- Stale `syncing` recovery after app restart.
- Exponential backoff and bounded retry.
- Permanent validation failure remains inspectable.
- Concurrent queue processors are prevented.
- Authentication failures no longer consume the retry budget.
- Sync Center Retry immediately invokes queue processing.
- Queued technician farmer registration can continue directly to animal registration using the temporary farmer ID; the queue infers and preserves the dependency.

## Remaining Verification

- Extend the proven farmer -> animal temporary-ID handoff to an optional animal -> official record handoff.
- Verify every active form actually includes the temporary parent ID when operating on an unsynced parent.
- Test expired Clerk session, sign-in recovery, and automatic resume.
- Test response loss after server commit.
- Test missing cached attachment recovery instructions.
- Decide whether the unused `(forms)/clients/register-client.tsx` route should redirect to the canonical technician registration screen.
