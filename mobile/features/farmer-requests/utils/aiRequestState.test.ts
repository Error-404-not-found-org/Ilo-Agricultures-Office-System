import test from "node:test";
import assert from "node:assert/strict";
import {
  findActiveAIRequestForAnimal,
  getAIRequestSubmitErrorMessage,
  getAIRequestSubmitState,
  getAIRequestInlineNotice,
  getAnimalPickerAdvisory,
  AI_REQUEST_INVALIDATION_KEYS,
  classifyAnimalSelection,
  checkAIRequestEligibilityForSubmit,
} from "./aiRequestState.ts";

test("aiRequestState finds active request for matching animal", () => {
  const requests = [
    { _id: "req-1", animalId: "animal-123", status: "pending" },
    { _id: "req-2", animalId: "animal-456", status: "rejected" },
    { _id: "req-3", animalId: { _id: "animal-789" }, status: "scheduled" },
  ];

  assert.equal(findActiveAIRequestForAnimal(requests, "animal-123")?._id, "req-1");
  assert.equal(findActiveAIRequestForAnimal(requests, "animal-456"), undefined);
  assert.equal(findActiveAIRequestForAnimal(requests, "animal-789")?._id, "req-3");
  assert.equal(findActiveAIRequestForAnimal(requests, undefined), undefined);
});

test("aiRequestState maps submit error messages correctly", () => {
  const duplicateError = {
    response: {
      data: {
        code: "ACTIVE_AI_REQUEST_EXISTS",
        message: "Duplicate",
      },
    },
  };
  assert.match(
    getAIRequestSubmitErrorMessage(duplicateError),
    /active AI service request already exists/i,
  );

  const genericError = {
    response: {
      data: {
        message: "Network timeout",
      },
    },
  };
  assert.equal(getAIRequestSubmitErrorMessage(genericError), "Network timeout");

  const unknownError = {};
  assert.equal(
    getAIRequestSubmitErrorMessage(unknownError),
    "Failed to submit request. Please try again.",
  );
});

test("aiRequestState calculates submit state with exact user disabled labels", () => {
  // Submitting
  const submittingState = getAIRequestSubmitState({
    hasActiveRequest: false,
    isSubmitting: true,
  });
  assert.equal(submittingState.disabled, true);
  assert.equal(submittingState.label, "Submitting...");

  // Active Request
  const activeReqState = getAIRequestSubmitState({
    hasActiveRequest: true,
    isSubmitting: false,
  });
  assert.equal(activeReqState.disabled, true);
  assert.equal(activeReqState.label, "AI Request Already Active");

  // Inseminated / unresolved breeding cycle
  const inseminatedState = getAIRequestSubmitState({
    hasActiveRequest: false,
    isSubmitting: false,
    isIneligible: true,
    reproductiveStatus: "Inseminated",
  });
  assert.equal(inseminatedState.disabled, true);
  assert.equal(inseminatedState.label, "Breeding Cycle in Progress");

  // Confirmed pregnancy
  const pregnantState = getAIRequestSubmitState({
    hasActiveRequest: false,
    isSubmitting: false,
    isIneligible: true,
    reproductiveStatus: "Pregnant",
  });
  assert.equal(pregnantState.disabled, true);
  assert.equal(pregnantState.label, "AI Request Unavailable");

  // Other ineligible fallback
  const otherIneligibleState = getAIRequestSubmitState({
    hasActiveRequest: false,
    isSubmitting: false,
    isIneligible: true,
  });
  assert.equal(otherIneligibleState.disabled, true);
  assert.equal(otherIneligibleState.label, "AI Request Unavailable");

  // Fully Eligible
  const eligibleState = getAIRequestSubmitState({
    hasActiveRequest: false,
    isSubmitting: false,
    isIneligible: false,
  });
  assert.equal(eligibleState.disabled, false);
  assert.equal(eligibleState.label, "Submit AI Service Request");
});

test("getAIRequestInlineNotice prioritizes active request and returns existing request route", () => {
  const notice = getAIRequestInlineNotice({
    activeRequest: { _id: "req-active-1", status: "in-progress" },
    selectedAnimal: { _id: "animal-1", reproductiveStatus: "Inseminated" },
    eligibility: { isEligible: false, reason: "Waiting for the current breeding cycle result." },
  });

  assert.ok(notice);
  assert.equal(notice?.type, "active_request");
  assert.equal(notice?.title, "Active AI request");
  assert.match(notice?.description || "", /In Progress/);
  assert.equal(notice?.actionLabel, "View existing request");
  assert.deepEqual(notice?.actionRoute, {
    pathname: "/(farmer)/ai-request-detail",
    params: { id: "req-active-1" },
  });
});

test("getAIRequestInlineNotice shows breeding cycle notice and timeline route for inseminated animal", () => {
  const notice = getAIRequestInlineNotice({
    activeRequest: undefined,
    selectedAnimal: { _id: "animal-cow-123", reproductiveStatus: "Inseminated" },
    eligibility: {
      isEligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason: "Waiting for the current breeding cycle result.",
    },
  });

  assert.ok(notice);
  assert.equal(notice?.type, "breeding_cycle");
  assert.equal(notice?.title, "Breeding cycle in progress");
  assert.equal(
    notice?.description,
    "This animal is currently being monitored after insemination. You can request AI again once the current breeding cycle has a confirmed outcome.",
  );
  assert.equal(notice?.actionLabel, "View breeding timeline");
  assert.deepEqual(notice?.actionRoute, {
    pathname: "/(farmer)/pregnancy-tracker",
    params: { id: "animal-cow-123" },
  });
});

test("getAIRequestInlineNotice returns null when animal is eligible and has no active request", () => {
  const notice = getAIRequestInlineNotice({
    activeRequest: undefined,
    selectedAnimal: { _id: "animal-open", reproductiveStatus: "Open" },
    eligibility: { isEligible: true },
  });

  assert.equal(notice, null);
});

test("getAnimalPickerAdvisory returns concise advisory for picker rows", () => {
  assert.equal(
    getAnimalPickerAdvisory({ isEligible: false }, false),
    "Waiting for the current breeding cycle result.",
  );
  assert.equal(
    getAnimalPickerAdvisory({ isEligible: false }, true),
    "An AI request is already active.",
  );
  assert.equal(
    getAnimalPickerAdvisory({ isEligible: true }, false),
    null,
  );
});

test("aiRequestState provides standard cache invalidation keys", () => {
  assert.deepEqual(AI_REQUEST_INVALIDATION_KEYS, [
    ["farmer", "requests"],
    ["farmer", "ai-requests"],
    ["ai-requests"],
  ]);
});

test("Requirement 1: Inseminated animal with no active request can be selected, avoids old modal, shows inline notice and disabled CTA", () => {
  const inseminatedAnimal = {
    _id: "animal-cow-101",
    animalId: "COW-101",
    gender: "Female",
    species: "Cattle",
    reproductiveStatus: "Inseminated",
  };
  const eligibility = {
    isEligible: false,
    code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
    reason: "Waiting for the current breeding cycle result.",
  };

  // 1. Animal picker selection classification: can be selected directly, no old modal
  const selection = classifyAnimalSelection(inseminatedAnimal, eligibility);
  assert.equal(selection.canSelectDirectly, true);
  assert.equal(selection.modalType, null);

  // 2. Persistent inline notice renders below selected animal
  const inlineNotice = getAIRequestInlineNotice({
    activeRequest: undefined,
    selectedAnimal: inseminatedAnimal,
    eligibility,
  });
  assert.ok(inlineNotice);
  assert.equal(inlineNotice.type, "breeding_cycle");
  assert.equal(inlineNotice.title, "Breeding cycle in progress");
  assert.equal(
    inlineNotice.description,
    "This animal is currently being monitored after insemination. You can request AI again once the current breeding cycle has a confirmed outcome.",
  );
  assert.equal(inlineNotice.actionLabel, "View breeding timeline");
  assert.deepEqual(inlineNotice.actionRoute, {
    pathname: "/(farmer)/pregnancy-tracker",
    params: { id: "animal-cow-101" },
  });

  // 3. Submit remains disabled with exact label
  const submitState = getAIRequestSubmitState({
    hasActiveRequest: false,
    isSubmitting: false,
    isIneligible: true,
    ineligibleReason: eligibility.reason,
    reproductiveStatus: inseminatedAnimal.reproductiveStatus,
  });
  assert.equal(submitState.disabled, true);
  assert.equal(submitState.label, "Breeding Cycle in Progress");
});

test("Requirement 2: Active AI request animal can be selected, renders active request notice, view existing request, and disabled submit", () => {
  const activeReqAnimal = {
    _id: "animal-cow-202",
    animalId: "COW-202",
    gender: "Female",
    species: "Cattle",
    reproductiveStatus: "Open",
  };
  const activeRequest = {
    _id: "req-999",
    animalId: "animal-cow-202",
    status: "scheduled",
  };
  const eligibility = {
    isEligible: false,
    code: "ACTIVE_AI_REQUEST_EXISTS",
    reason: "An AI request is already active.",
  };

  // 1. Can be selected directly without generic blocking modal
  const selection = classifyAnimalSelection(activeReqAnimal, eligibility);
  assert.equal(selection.canSelectDirectly, true);
  assert.equal(selection.modalType, null);

  // 2. Inline active request notice renders with view existing request link
  const inlineNotice = getAIRequestInlineNotice({
    activeRequest,
    selectedAnimal: activeReqAnimal,
    eligibility,
  });
  assert.ok(inlineNotice);
  assert.equal(inlineNotice.type, "active_request");
  assert.equal(inlineNotice.title, "Active AI request");
  assert.match(inlineNotice.description, /Scheduled/);
  assert.equal(inlineNotice.actionLabel, "View existing request");
  assert.deepEqual(inlineNotice.actionRoute, {
    pathname: "/(farmer)/ai-request-detail",
    params: { id: "req-999" },
  });

  // 3. Submit button disabled with exact label
  const submitState = getAIRequestSubmitState({
    hasActiveRequest: true,
    isSubmitting: false,
  });
  assert.equal(submitState.disabled, true);
  assert.equal(submitState.label, "AI Request Already Active");
});

test("Requirement 3: Eligible animal selects normally, no blocked-state notice, normal submit flow available", () => {
  const eligibleAnimal = {
    _id: "animal-cow-303",
    animalId: "COW-303",
    gender: "Female",
    species: "Cattle",
    reproductiveStatus: "Open",
  };
  const eligibility = {
    isEligible: true,
  };

  // 1. Animal picker selects directly
  const selection = classifyAnimalSelection(eligibleAnimal, eligibility);
  assert.equal(selection.canSelectDirectly, true);
  assert.equal(selection.modalType, null);

  // 2. No blocked-state notice
  const inlineNotice = getAIRequestInlineNotice({
    activeRequest: undefined,
    selectedAnimal: eligibleAnimal,
    eligibility,
  });
  assert.equal(inlineNotice, null);

  // 3. Submit enabled with normal label
  const submitState = getAIRequestSubmitState({
    hasActiveRequest: false,
    isSubmitting: false,
    isIneligible: false,
  });
  assert.equal(submitState.disabled, false);
  assert.equal(submitState.label, "Submit AI Service Request");
});

test("Requirement 4: Switching from blocked animal to eligible animal clears notice and restores normal CTA", () => {
  const blockedAnimal = {
    _id: "animal-blocked-1",
    animalId: "COW-BLOCKED",
    gender: "Female",
    species: "Cattle",
    reproductiveStatus: "Inseminated",
  };
  const blockedEligibility = {
    isEligible: false,
    code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
    reason: "Waiting for the current breeding cycle result.",
  };

  // Step A: Farmer selects blocked animal
  const blockedNotice = getAIRequestInlineNotice({
    activeRequest: undefined,
    selectedAnimal: blockedAnimal,
    eligibility: blockedEligibility,
  });
  assert.ok(blockedNotice);
  assert.equal(blockedNotice.type, "breeding_cycle");

  const blockedSubmitState = getAIRequestSubmitState({
    hasActiveRequest: false,
    isSubmitting: false,
    isIneligible: true,
    ineligibleReason: blockedEligibility.reason,
    reproductiveStatus: blockedAnimal.reproductiveStatus,
  });
  assert.equal(blockedSubmitState.disabled, true);
  assert.equal(blockedSubmitState.label, "Breeding Cycle in Progress");

  // Step B: Farmer re-opens picker and selects eligible animal
  const eligibleAnimal = {
    _id: "animal-eligible-2",
    animalId: "COW-ELIGIBLE",
    gender: "Female",
    species: "Cattle",
    reproductiveStatus: "Open",
  };
  const eligibleEligibility = {
    isEligible: true,
  };

  const restoredNotice = getAIRequestInlineNotice({
    activeRequest: undefined,
    selectedAnimal: eligibleAnimal,
    eligibility: eligibleEligibility,
  });
  assert.equal(restoredNotice, null, "Inline notice must disappear when switching to eligible animal");

  const restoredSubmitState = getAIRequestSubmitState({
    hasActiveRequest: false,
    isSubmitting: false,
    isIneligible: false,
  });
  assert.equal(restoredSubmitState.disabled, false);
  assert.equal(restoredSubmitState.label, "Submit AI Service Request", "Normal CTA must restore");
});

test("Requirement 5: Programmatic submission check refuses ineligible animals as defense in depth", () => {
  // Case A: Inseminated animal
  const insemCheck = checkAIRequestEligibilityForSubmit({
    selectedAnimal: { _id: "a1", reproductiveStatus: "Inseminated" },
    activeRequest: undefined,
    eligibility: { isEligible: false, reason: "Waiting for the current breeding cycle result." },
  });
  assert.equal(insemCheck.canSubmit, false);
  assert.equal(insemCheck.blockType, "ineligible");
  assert.equal(insemCheck.blockReason, "Waiting for the current breeding cycle result.");

  // Case B: Active AI request
  const activeReqCheck = checkAIRequestEligibilityForSubmit({
    selectedAnimal: { _id: "a2", reproductiveStatus: "Open" },
    activeRequest: { _id: "req-1", status: "pending" },
    eligibility: { isEligible: false, reason: "An AI request is already active." },
  });
  assert.equal(activeReqCheck.canSubmit, false);
  assert.equal(activeReqCheck.blockType, "active_request");

  // Case C: Pregnant animal
  const pregnantCheck = checkAIRequestEligibilityForSubmit({
    selectedAnimal: { _id: "a3", reproductiveStatus: "Pregnant" },
    activeRequest: undefined,
    eligibility: { isEligible: false, reason: "This animal is currently pregnant." },
  });
  assert.equal(pregnantCheck.canSubmit, false);
  assert.equal(pregnantCheck.blockType, "pregnant");

  // Case D: No animal selected
  const noAnimalCheck = checkAIRequestEligibilityForSubmit({
    selectedAnimal: null,
  });
  assert.equal(noAnimalCheck.canSubmit, false);
  assert.equal(noAnimalCheck.blockType, "no_animal");

  // Case E: Fully eligible animal
  const eligibleCheck = checkAIRequestEligibilityForSubmit({
    selectedAnimal: { _id: "a4", reproductiveStatus: "Open" },
    activeRequest: undefined,
    eligibility: { isEligible: true },
  });
  assert.equal(eligibleCheck.canSubmit, true);
});

test("Audit of modals: Male animals and underage animals preserve informational blocking modals", () => {
  // Male animal hard block
  const maleAnimal = {
    _id: "bull-1",
    gender: "Male",
    species: "Cattle",
  };
  const maleEligibility = {
    isEligible: false,
    code: "FEMALE_REQUIRED",
    reason: "Artificial insemination is only available for female animals.",
  };
  const maleSelection = classifyAnimalSelection(maleAnimal, maleEligibility);
  assert.equal(maleSelection.canSelectDirectly, false);
  assert.equal(maleSelection.modalType, "male");
  assert.match(maleSelection.reason || "", /male/i);

  // Underage animal hard block
  const calf = {
    _id: "calf-1",
    gender: "Female",
    species: "Cattle",
  };
  const calfEligibility = {
    isEligible: false,
    code: "AGE_INELIGIBLE",
    reason: "Animal is too young for insemination. Minimum age for Cattle is 14 months.",
  };
  const calfSelection = classifyAnimalSelection(calf, calfEligibility);
  assert.equal(calfSelection.canSelectDirectly, false);
  assert.equal(calfSelection.modalType, "age");
  assert.match(calfSelection.reason || "", /minimum breeding age|too young/i);
});
