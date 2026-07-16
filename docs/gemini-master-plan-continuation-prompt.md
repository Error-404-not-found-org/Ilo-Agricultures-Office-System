# Gemini Continuation Prompt

Copy the prompt below into Gemini when handing off the next implementation phase.

```text
You are continuing implementation in this repository:
C:\Users\Acer\Documents\Ilo-AgriculturesOffice-System

Read these documents completely before changing code:
1. docs/master-web-mobile-completion-plan.md
2. docs/phase-0-route-endpoint-inventory.md
3. docs/web-technician-ui-improvement-plan.md
4. docs/workflow-and-offline-consolidation-plan.md

Current verified state as of 2026-07-12:
- Backend workflow consolidation, shared status vocabulary, legacy status compatibility, and offline executor consolidation are implemented.
- Backend tests previously passed: 69/69.
- Web lint, 14 tests, and production build previously passed.
- Mobile TypeScript previously passed; mobile lint had 0 errors and 115 existing warnings.
- Technician sidebar terminology and hierarchy were updated so farmer/animal discovery appears before specialized records.
- Web titles now use plain language: Farmers, Animals, Service Requests, Schedule, Map & Locations, Breeding & Pregnancy Records, and Reports & Exports.
- Existing URL slugs were intentionally preserved.
- Phases 2-5 were implemented and independently repaired. Read docs/phases-2-5-verification-audit.md.
- A development database backup and the status migration have NOT been performed. Do not run a migration until a backup is confirmed.

Your task is to continue with Phases 6 and 7 of the master plan: Mobile Workflow Completion and Offline Queue Hardening. Re-audit the current code first because Phases 2-5 have since been implemented and repaired.

Required outcomes:
1. Audit every active technician and farmer mobile mutation before editing.
2. Produce a mutation inventory with screen, endpoint, online behavior, offline behavior, entity type, temporary ID behavior, and dependencies.
3. Migrate remaining manual connectivity/queue wrappers to useOfflineMutation or executeOfflineMutation where queueing is appropriate.
4. Confirm farmer registration, animal registration, AI, health, pregnancy, calving, and service requests close/reset normally when queued.
5. Ensure every queued operation displays finite non-blocking confirmation and never renders an error object as React text.
6. Verify stable idempotency keys are retained across response-loss and retry.
7. Verify farmer -> animal -> record temporary-ID dependencies synchronize in order and resolve URL/payload references.
8. Ensure permanent validation failures stop retrying and remain inspectable in Sync Center.
9. Ensure authentication failures wait for a refreshed session rather than exhausting retries immediately.
10. Verify app restart recovers stale syncing items without duplication.
11. Add focused tests for dependency ordering, ID replacement, retry classification, response-loss idempotency, and missing attachments.
12. Preserve existing API routes, domain rules, role protection, brand system, dark mode, and user changes.

Before implementation:
- Inspect package.json before importing any dependency.
- Inspect backend controllers/routes to verify the actual supported query parameters.
- Check the working tree and preserve unrelated user changes.
- Write a short plan and list the exact files in scope.

Verification required:
- Run mobile TypeScript and lint.
- Run backend tests if API or queue server contracts change.
- Run web lint, tests, and build if shared contracts change.
- Manually test Expo Go online, offline, app restart, and reconnect flows when available.

Documentation required after implementation:
- Update docs/master-web-mobile-completion-plan.md with completed tasks, test results, known issues, and a conservative revised overall percentage.
- Update docs/phase-0-route-endpoint-inventory.md if any API ownership or route behavior changes.
- Clearly list anything not tested manually.

Safety rules:
- Do not run npm run migrate:status-vocabulary until a verified database backup exists.
- Do not remove compatibility routes.
- Do not delete legacy modules unless there are no imports, no routes, and no queued-client compatibility requirements.
- Do not mark Phases 6 or 7 complete unless every acceptance criterion in the master plan passes.
```
