# BreedSmart Farmer Breeding Observation Prompt For Antigravity

Use this prompt if Antigravity needs to continue the implementation.

```txt
Review and revise or continue the BreedSmart Farmer Breeding Outcome / Observation Reporting implementation.

Project context:
BreedSmart helps farmers and technicians manage animals, AI/insemination, pregnancy checks, calving, offspring, health requests, animal history, and reports.

Important current workflow:
- Farmers can request AI.
- Technicians perform/approve/schedule AI.
- Farmers currently have a pending AI outcome confirmation flow.
- Technicians record pregnancy checks.
- Pregnancy records should represent verified/clinical pregnancy diagnosis.
- Calving records should represent delivery and offspring.
- The client workflow currently uses technicians for breeding and health assistance.

Existing backend behavior:
BreedSmart already has farmer AI outcome handling through:

PATCH /api/ai-request/:id/outcome

Current backend behavior already updates:
- Insemination.isSuccess
- Insemination.outcome
- Animal.reproductiveStatus
- Pregnancy record creation
- expected calving date
- Inngest calving reminders
- farmer dashboard pending outcomes

Because of this, avoid creating duplicate source-of-truth logic.

Main concern:
The proposed BreedingReport model may duplicate existing Insemination, Pregnancy, and Animal reproductive status logic. We must prevent inconsistent states like:
- BreedingReport says pregnant
- Insemination says pending
- Pregnancy says empty
- Animal says likely pregnant

Your task:
Implement or continue “Farmer Breeding Observation Reporting” instead of “Farmer Breeding Outcome Confirmation.”

Core rules:
1. Farmer reports breeding observations, not confirmed diagnosis.
2. Farmer observation should not directly create a confirmed Pregnancy record.
3. Only technician pregnancy check should confirm Pregnancy and set Animal.reproductiveStatus to Pregnant.
4. Farmer “possible pregnancy” should set status to Likely Pregnant only if appropriate.
5. Farmer “return to heat / failed AI” should set status to In Heat or Heat Return Observed, not Normal.
6. If technician verification is requested, create a technician task/follow-up or pregnancy-check request, not a generic health request unless absolutely necessary.
7. Keep the existing Insemination as the source of truth for the AI attempt.
8. Keep Pregnancy as the source of truth for confirmed pregnancy diagnosis.
9. Keep Calving as the source of truth for delivery/offspring.
10. Use timeline events and audit logs to record farmer observations.
11. Do not create duplicate milestone jobs or duplicate AI outcome workflows.
12. Do not redesign the app UI from scratch.

Schema caution:
Do not add "pregnancy_verification" under symptoms enum because HealthRequest.symptoms is currently a string, not an enum.

Preferred backend design:
Extend the existing Insemination model with observation fields instead of adding a new source-of-truth model.

Suggested fields:
- farmerOutcomeReport
- farmerOutcomeReportedAt
- farmerObservationSigns
- farmerObservationNotes
- evidenceImageUrl or evidencePhotos
- verificationRequested
- verificationStatus: not_requested | pending | verified | rejected
- verificationTaskId or followUpId
- reviewedBy
- reviewedAt

Create a clearer endpoint instead of overloading the old outcome endpoint:

POST /api/ai-request/:id/farmer-observation

Behavior:
- Validate authenticated user.
- Validate farmer owns the animal/request.
- Validate AI request is completed/done and still awaiting outcome/observation.
- Save farmer observation on the existing Insemination.
- Create timeline event:
  farmer_breeding_observation_reported
- Create audit log.
- If report is possible_pregnancy:
  - set animal.reproductiveStatus to Likely Pregnant, not Pregnant.
  - do not create Pregnancy record.
- If report is return_to_heat:
  - set animal.reproductiveStatus to In Heat.
  - mark Insemination outcome as Failed (Re-heat) only if this matches existing workflow rules.
  - do not set animal to Normal.
- If report is unsure:
  - keep current reproductive status unless backend rules determine a safe status update.
- If verificationRequested:
  - create technician Task/FollowUp or pregnancy-check queue item.
  - link the task/follow-up to the Insemination.
  - do not create a generic HealthRequest unless task/follow-up support is unavailable.
- Return clear status and next action.

CattleCore audit requirement:
Before or during implementation, audit cattleCore usage.

Files:
- mobile_2.0/lib/cattleCore.ts
- backend_2.0/src/utils/cattleCore.js

Important cattleCore rules:
- Backend cattleCore.js remains the source of truth for validation and persisted workflow decisions.
- Mobile cattleCore.ts should only guide UI estimates and explain milestones.
- Do not rely on mobile-only cattleCore calculations for authoritative status changes.
- Use generatePregnancyTimeline() in the new Report Breeding Observation screen to display:
  - Day 21 heat return check
  - Day 35 ultrasound window
  - Day 60 palpation/pregnancy check
  - expected calving estimate
- Do not create a confirmed Pregnancy record from mobile estimates.
- Only technician pregnancy check should confirm pregnancy.
- cattleCore must remain pure domain logic.
- Do not put API calls, database queries, notifications, or persistence inside cattleCore.

Known cattleCore issue to address:
verifyPostpartumWindow currently uses Math.abs between action date and calving date. This can incorrectly treat dates before calving as valid elapsed time.

Current risky logic:
Math.abs(action.getTime() - calving.getTime())

Better direction:
Use directional date difference:
action date - calving date

Actions before calving should never be considered safe.

Also check for drift between:
- mobile_2.0/lib/cattleCore.ts
- backend_2.0/src/utils/cattleCore.js

They should not silently diverge.

Inngest reminder review:
Existing backend Inngest lifecycle already has:
- Day 18 heat reminder
- Day 21 farmer confirmation
- Day 25 technician nudge
- Day 60 pregnancy diagnosis reminder
- Day 75 missed PD nudge

So:
- Do not create duplicate reminder jobs.
- If farmer Day 60 notification is needed, modify the existing Day 60 reminder in the lifecycle job.
- If the UI needs milestone display, use cattleCore display helpers.
- If backend reminders need milestone constants, consider extracting shared constants or keeping a clearly documented mapping.

Mobile revised direction:
Create “Report Breeding Observation,” not “Report Breeding Outcome.”

Possible route:
mobile_2.0/app/(farmer)/report-breeding-observation/index.tsx

Show the action only for animals with:
- Inseminated
- Likely Pregnant

UI wording:
- Make it clear this is farmer observation, not pregnancy diagnosis.
- Avoid saying the farmer is confirming pregnancy.
- Use wording like:
  “Tell the technician what you observed.”
  “This does not replace pregnancy diagnosis.”
  “A technician may verify this report.”

Suggested steps:
1. Select observation:
   - Possible pregnancy
   - Returned to heat
   - Unsure
2. Select signs:
   Possible pregnancy examples:
   - did not return to heat
   - calmer behavior
   - positive milk/blood/test strip if available
   - physical changes observed
   Returned to heat examples:
   - standing heat
   - clear mucus discharge
   - mounting/being mounted
   - restlessness/vocalization
3. Add notes/photos.
4. Optional technician verification request.
5. Review and submit.

Use cattleCore:
- Show interactive milestone timeline using generatePregnancyTimeline().
- Show current estimated day after AI.
- Show Day 21, Day 35, Day 60, expected calving estimate.
- Clearly mark estimates as guidance only.

After submission:
- Show success state.
- Show whether technician verification is pending.
- Add observation to animal timeline.
- Update local query caches.

Technician side:
- Technician queue should show pregnancy verification/follow-up items if verification was requested.
- Technician can review farmer observation.
- Technician should use the existing pregnancy-check workflow to record actual diagnosis.
- Technician verification is what creates/updates confirmed Pregnancy state.
- Add badge like “Pregnancy Check” or “Breeding Verification.”
- Do not call this a health emergency or vet case.

Backend tests to include:
- Farmer cannot report observation for another farmer’s animal.
- Farmer cannot report observation for unrelated insemination.
- Possible pregnancy does not create Pregnancy record.
- Return-to-heat does not create Pregnancy record.
- Return-to-heat does not set animal status to Normal.
- Technician pregnancy check still creates/updates Pregnancy.
- Duplicate farmer observation for the same insemination is handled safely.
- Verification request creates exactly one linked task/follow-up.
- Existing AI outcome endpoint behavior does not conflict.
- Timeline event is created.
- Audit log is created.
- cattleCore postpartum boundary test covers action date before calving.
- cattleCore species/breed fallback tests still pass.

Mobile verification:
- Farmer sees Report Breeding Observation only when appropriate.
- Farmer can submit possible pregnancy observation.
- Farmer can submit return-to-heat observation.
- Farmer can request technician verification.
- Observation appears in animal timeline.
- Technician sees verification task/queue item.
- Technician can proceed to pregnancy check.
- No duplicate Pregnancy records are created.
- TypeScript passes.
- Lint passes.

Acceptance criteria:
- No duplicate source of truth between BreedingReport, Insemination, Pregnancy, and Animal.
- Farmer observation does not directly confirm clinical pregnancy.
- Return-to-heat does not reset animal to Normal.
- Day 60 reminder reuses existing Inngest lifecycle job.
- Timeline records farmer observation.
- Technician verification connects to existing pregnancy-check workflow.
- cattleCore remains pure domain logic.
- Backend validates all breeding workflow decisions.
- Mobile only displays estimates and guidance.
- Mobile and backend cattleCore behavior stays consistent.
- TypeScript, lint, and backend tests pass.
```
