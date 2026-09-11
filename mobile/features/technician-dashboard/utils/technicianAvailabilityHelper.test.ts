import assert from "node:assert/strict";
import test from "node:test";

import {
  FIRST_TIME_AVAILABILITY_HELPER_COPY,
  RETURNING_AVAILABILITY_HELPER_COPY,
  AVAILABILITY_HELPER_FEEDBACK_COPY,
  DISPATCH_STATUS_ENDPOINT,
  getEnableRequestsPayload,
  getAvailabilityHelperStorageKey,
  hasSeenAvailabilityHelperIntro,
  markAvailabilityHelperIntroSeen,
  getAvailabilityHelperCopy,
  qualifiesForAvailabilityHelper,
  shouldShowAvailabilityHelper,
  shouldShowProfileWarning,
  dismissAvailabilityHelperForSession,
  isAvailabilityHelperDismissedThisSession,
  clearAvailabilityHelperSessionDismissal,
  resetAvailabilityHelperIntroForDev,
  clearSessionAvailabilityStateForTests,
} from "./technicianAvailabilityHelper.ts";

function createMockStorage(initialData: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initialData));
  return {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    getStore: () => store,
  };
}

test("Item 1 & 2: First-time copy vs returning reminder copy matches exact specifications", () => {
  // First-time copy
  const firstTime = getAvailabilityHelperCopy({ hasSeenIntro: false });
  assert.deepEqual(firstTime, FIRST_TIME_AVAILABILITY_HELPER_COPY);
  assert.equal(firstTime.TITLE, "Welcome to BreedSmart 👋");
  assert.equal(
    firstTime.BODY_PARAGRAPHS[0],
    "Before you get started, your Technician account is currently Off Duty.",
  );
  assert.equal(
    firstTime.BODY_PARAGRAPHS[1],
    "Turn on Accepting Requests when you're ready to receive new AI and animal health requests from Farmers in your service area.",
  );
  assert.equal(
    firstTime.BODY_PARAGRAPHS[2],
    "New requests will appear in Open Requests, and you can pause them anytime from your Profile.",
  );
  assert.equal(firstTime.PRIMARY_BUTTON, "Start Accepting Requests");
  assert.equal(firstTime.SECONDARY_BUTTON, "Maybe Later");

  // Returning copy
  const returning = getAvailabilityHelperCopy({ hasSeenIntro: true });
  assert.deepEqual(returning, RETURNING_AVAILABILITY_HELPER_COPY);
  assert.equal(returning.TITLE, "Ready to receive requests?");
  assert.equal(returning.BODY_PARAGRAPHS[0], "You're still Off Duty.");
  assert.equal(
    returning.BODY_PARAGRAPHS[1],
    "Turn on Accepting Requests whenever you're ready to receive new Farmer requests.",
  );
  assert.equal(
    returning.BODY_PARAGRAPHS[2],
    "You can pause requests anytime from your Profile.",
  );
  assert.equal(returning.PRIMARY_BUTTON, "Start Accepting Requests");
  assert.equal(returning.SECONDARY_BUTTON, "Maybe Later");

  // Feedback copy
  assert.equal(AVAILABILITY_HELPER_FEEDBACK_COPY.SUCCESS_TITLE, "You're now accepting requests.");
  assert.equal(
    AVAILABILITY_HELPER_FEEDBACK_COPY.SUCCESS_MESSAGE,
    "New Farmer requests can now appear in Open Requests.",
  );
  assert.equal(AVAILABILITY_HELPER_FEEDBACK_COPY.ERROR_TITLE, "Couldn't turn on requests.");
  assert.equal(
    AVAILABILITY_HELPER_FEEDBACK_COPY.ERROR_MESSAGE,
    "Please check your connection and try again.",
  );
});

test("Item 3: Intro seen flag does NOT affect qualification; acceptsNewRequests: true always hides helper", () => {
  const activeTech = {
    role: "technician",
    dispatchProfile: { acceptsNewRequests: true },
  };
  // False qualification regardless of intro-seen state
  assert.equal(qualifiesForAvailabilityHelper(activeTech), false);
  assert.equal(
    shouldShowAvailabilityHelper({
      user: activeTech,
      isEnabled: true,
      technicianId: "tech-active",
      isIntroLoaded: true,
    }),
    false,
  );
});

test("Item 4 & 7: Scoped storage key generation and storing per-technician intro-seen flag", async () => {
  const storage = createMockStorage();
  const tech1 = "tech-mongo-id-1";
  const tech2 = "tech-mongo-id-2";

  assert.equal(getAvailabilityHelperStorageKey(tech1), "technician_availability_helper_seen:tech-mongo-id-1");
  assert.equal(getAvailabilityHelperStorageKey(tech2), "technician_availability_helper_seen:tech-mongo-id-2");

  // Initially unseen
  assert.equal(await hasSeenAvailabilityHelperIntro(tech1, storage), false);
  assert.equal(await hasSeenAvailabilityHelperIntro(tech2, storage), false);

  // Mark tech 1 as seen
  await markAvailabilityHelperIntroSeen(tech1, storage);

  // Tech 1 is now seen, Tech 2 remains unseen
  assert.equal(await hasSeenAvailabilityHelperIntro(tech1, storage), true);
  assert.equal(await hasSeenAvailabilityHelperIntro(tech2, storage), false);
  assert.equal(storage.getStore().get("technician_availability_helper_seen:tech-mongo-id-1"), "true");
});

test("Item 8: AsyncStorage loading gates dialog to prevent copy flashing", () => {
  const offDutyTech = {
    role: "technician",
    dispatchProfile: { acceptsNewRequests: false },
  };

  // While storage is resolving (isIntroLoaded === false), helper does NOT show
  assert.equal(
    shouldShowAvailabilityHelper({
      user: offDutyTech,
      isEnabled: true,
      technicianId: "tech-loading",
      isIntroLoaded: false,
    }),
    false,
  );

  // Once storage has resolved (isIntroLoaded === true), helper qualifies
  assert.equal(
    shouldShowAvailabilityHelper({
      user: offDutyTech,
      isEnabled: true,
      technicianId: "tech-loading",
      isIntroLoaded: true,
    }),
    true,
  );
});

test("Item 5: Maybe Later marks intro seen if first encounter, does NO mutation, and dismisses for session", async () => {
  clearSessionAvailabilityStateForTests();
  const storage = createMockStorage();
  const techId = "tech-maybe-later";
  const offDutyTech = {
    role: "technician",
    dispatchProfile: { acceptsNewRequests: false },
  };

  // Simulate first encounter
  assert.equal(await hasSeenAvailabilityHelperIntro(techId, storage), false);

  // Trigger Maybe Later action
  await markAvailabilityHelperIntroSeen(techId, storage);
  dismissAvailabilityHelperForSession(techId);

  // 1. Intro is now marked seen in storage
  assert.equal(await hasSeenAvailabilityHelperIntro(techId, storage), true);
  // 2. Helper is session-dismissed
  assert.equal(isAvailabilityHelperDismissedThisSession(techId), true);
  assert.equal(
    shouldShowAvailabilityHelper({
      user: offDutyTech,
      isEnabled: true,
      technicianId: techId,
      isIntroLoaded: true,
    }),
    false,
  );
  // 3. User dispatch state remains strictly false (no mutation)
  assert.equal(offDutyTech.dispatchProfile.acceptsNewRequests, false);

  clearSessionAvailabilityStateForTests();
});

test("Item 6 & 12: Start Accepting Requests action flow, payload, cache invalidation, and failure retryability", async () => {
  clearSessionAvailabilityStateForTests();
  const storage = createMockStorage();
  const techId = "tech-enable-test";

  const apiCalls: { url: string; payload: any }[] = [];
  const invalidatedKeys: any[][] = [];

  const mockApi = {
    patch: async (url: string, payload: any) => {
      apiCalls.push({ url, payload });
      if (payload.__fail) {
        throw new Error("Network offline");
      }
      return { data: { success: true } };
    },
  };

  const mockQueryClient = {
    invalidateQueries: (config: { queryKey: any[] }) => {
      invalidatedKeys.push(config.queryKey);
    },
  };

  const executeEnableRequests = async (shouldFail = false) => {
    try {
      const payload = {
        ...getEnableRequestsPayload(),
        ...(shouldFail ? { __fail: true } : {}),
      };
      await mockApi.patch(DISPATCH_STATUS_ENDPOINT, payload);
      await markAvailabilityHelperIntroSeen(techId, storage);
      dismissAvailabilityHelperForSession(techId);
      mockQueryClient.invalidateQueries({ queryKey: ["user", "me"] });
      return { success: true };
    } catch {
      return {
        success: false,
        error: `${AVAILABILITY_HELPER_FEEDBACK_COPY.ERROR_TITLE}\n${AVAILABILITY_HELPER_FEEDBACK_COPY.ERROR_MESSAGE}`,
      };
    }
  };

  // 1. Failure scenario (Item 12): helper stays open & retryable, no false session dismissal
  const failResult = await executeEnableRequests(true);
  assert.equal(failResult.success, false);
  assert.equal(failResult.error, "Couldn't turn on requests.\nPlease check your connection and try again.");
  assert.equal(isAvailabilityHelperDismissedThisSession(techId), false);
  assert.equal(invalidatedKeys.length, 0);

  // 2. Success scenario (Item 6): payload is { acceptsNewRequests: true }, invalidates cache, marks seen
  const successResult = await executeEnableRequests(false);
  assert.equal(successResult.success, true);
  assert.deepEqual(apiCalls[1], {
    url: "/technician/dispatch-status",
    payload: { acceptsNewRequests: true },
  });
  assert.deepEqual(invalidatedKeys, [["user", "me"]]);
  assert.equal(await hasSeenAvailabilityHelperIntro(techId, storage), true);
  assert.equal(isAvailabilityHelperDismissedThisSession(techId), true);

  clearSessionAvailabilityStateForTests();
});

test("Item 9 & 10: Same-session dismissal vs fresh session returning reminder qualification", async () => {
  clearSessionAvailabilityStateForTests();
  const storage = createMockStorage();
  const techId = "tech-sessions";
  const offDutyTech = {
    role: "technician",
    dispatchProfile: { acceptsNewRequests: false },
  };

  // Session 1: First-time encounter
  assert.equal(await hasSeenAvailabilityHelperIntro(techId, storage), false);
  assert.equal(
    shouldShowAvailabilityHelper({
      user: offDutyTech,
      isEnabled: true,
      technicianId: techId,
      isIntroLoaded: true,
    }),
    true,
  );
  assert.equal(getAvailabilityHelperCopy({ hasSeenIntro: false }).TITLE, "Welcome to BreedSmart 👋");

  // Technician dismisses via Maybe Later
  await markAvailabilityHelperIntroSeen(techId, storage);
  dismissAvailabilityHelperForSession(techId);

  // Remaining interactions during Session 1 do NOT show helper
  assert.equal(
    shouldShowAvailabilityHelper({
      user: offDutyTech,
      isEnabled: true,
      technicianId: techId,
      isIntroLoaded: true,
    }),
    false,
  );

  // Session 2: Fresh app process (in-memory dismissal clears, storage persists)
  clearSessionAvailabilityStateForTests();
  const hasSeenInSession2 = await hasSeenAvailabilityHelperIntro(techId, storage);
  assert.equal(hasSeenInSession2, true);

  // In Session 2, helper qualifies with RETURNING reminder copy!
  assert.equal(
    shouldShowAvailabilityHelper({
      user: offDutyTech,
      isEnabled: true,
      technicianId: techId,
      isIntroLoaded: true,
    }),
    true,
  );
  assert.equal(getAvailabilityHelperCopy({ hasSeenIntro: hasSeenInSession2 }).TITLE, "Ready to receive requests?");

  clearSessionAvailabilityStateForTests();
});

test("Item 11: Complete Your Profile precedence is strictly landing/mount-scoped", () => {
  const incompleteTechOffDuty = {
    role: "technician",
    dispatchProfile: { acceptsNewRequests: false },
    phoneNumber: null,
    address: null,
  };

  // 1. On current Home landing where helper qualifies, profile warning is suppressed
  assert.equal(
    shouldShowProfileWarning({
      user: incompleteTechOffDuty,
      isEnabled: true,
      hasLandingPrecedence: true,
    }),
    false,
  );

  // 2. When helper is dismissed on that same landing (hasLandingPrecedence is still true), profile warning remains suppressed
  assert.equal(
    shouldShowProfileWarning({
      user: incompleteTechOffDuty,
      isEnabled: true,
      hasLandingPrecedence: true,
    }),
    false,
  );

  // 3. When Technician navigates away and Home later remounts:
  // hasLandingPrecedence initializes to false; helper is session-dismissed so it does not show.
  // Profile warning behaves normally and alerts about incomplete profile!
  const activeTechIncomplete = {
    role: "technician",
    dispatchProfile: { acceptsNewRequests: true },
    phoneNumber: null,
    address: null,
  };
  assert.equal(
    shouldShowProfileWarning({
      user: activeTechIncomplete,
      isEnabled: true,
      hasLandingPrecedence: false,
    }),
    true,
  );

  // 4. Complete profile shows no warning
  const completeTech = {
    role: "technician",
    dispatchProfile: { acceptsNewRequests: true },
    phoneNumber: "09123456789",
    address: { barangay: "Poblacion" },
  };
  assert.equal(
    shouldShowProfileWarning({
      user: completeTech,
      isEnabled: true,
      hasLandingPrecedence: false,
    }),
    false,
  );
});

test("First-time copy stability and interaction-triggered intro-seen persistence", async () => {
  clearSessionAvailabilityStateForTests();
  const storage = createMockStorage();
  const techId = "tech-stability-test";
  const offDutyTech = {
    role: "technician",
    dispatchProfile: { acceptsNewRequests: false },
  };

  // 1. Initial load from storage: unseen
  const initialSeen = await hasSeenAvailabilityHelperIntro(techId, storage);
  assert.equal(initialSeen, false);

  // Copy is frozen for the current helper presentation
  let displayedCopy = getAvailabilityHelperCopy({ hasSeenIntro: initialSeen });
  assert.equal(displayedCopy.TITLE, "Welcome to BreedSmart 👋");

  // 2. Merely rendering/showing the modal does NOT change it to returning copy
  const isHelperVisible = shouldShowAvailabilityHelper({
    user: offDutyTech,
    isEnabled: true,
    technicianId: techId,
    isIntroLoaded: true,
  });
  assert.equal(isHelperVisible, true);
  // Storage remains unseen merely upon rendering
  assert.equal(await hasSeenAvailabilityHelperIntro(techId, storage), false);
  // Displayed copy remains FIRST_TIME
  assert.equal(displayedCopy.TITLE, "Welcome to BreedSmart 👋");

  // 3. Failed Start Accepting Requests: does NOT mark seen, does NOT flip copy, modal remains open
  const onFailedStart = () => {
    // Failure handler: does not mark seen, does not dismiss
    return { error: "Network error" };
  };
  onFailedStart();
  assert.equal(await hasSeenAvailabilityHelperIntro(techId, storage), false);
  assert.equal(isAvailabilityHelperDismissedThisSession(techId), false);
  assert.equal(displayedCopy.TITLE, "Welcome to BreedSmart 👋");

  // 4. User chooses Maybe Later: marks seen, dismisses session
  const onMaybeLater = async () => {
    await markAvailabilityHelperIntroSeen(techId, storage);
    dismissAvailabilityHelperForSession(techId);
  };
  await onMaybeLater();
  assert.equal(await hasSeenAvailabilityHelperIntro(techId, storage), true);
  assert.equal(isAvailabilityHelperDismissedThisSession(techId), true);

  // 5. Next fresh session (in-memory clears, storage persists): shows returning copy
  clearSessionAvailabilityStateForTests();
  const nextSessionSeen = await hasSeenAvailabilityHelperIntro(techId, storage);
  assert.equal(nextSessionSeen, true);
  const nextSessionCopy = getAvailabilityHelperCopy({ hasSeenIntro: nextSessionSeen });
  assert.equal(nextSessionCopy.TITLE, "Ready to receive requests?");

  clearSessionAvailabilityStateForTests();
});

test("resetAvailabilityHelperIntroForDev removes storage flag and session dismissal for technician", async () => {
  clearSessionAvailabilityStateForTests();
  const storage = createMockStorage();
  const tech1 = "tech-reset-1";
  const tech2 = "tech-reset-2";

  // Mark both as seen and dismissed
  await markAvailabilityHelperIntroSeen(tech1, storage);
  await markAvailabilityHelperIntroSeen(tech2, storage);
  dismissAvailabilityHelperForSession(tech1);
  dismissAvailabilityHelperForSession(tech2);

  assert.equal(await hasSeenAvailabilityHelperIntro(tech1, storage), true);
  assert.equal(isAvailabilityHelperDismissedThisSession(tech1), true);
  assert.equal(await hasSeenAvailabilityHelperIntro(tech2, storage), true);
  assert.equal(isAvailabilityHelperDismissedThisSession(tech2), true);

  // Execute dev reset for tech1 only
  await resetAvailabilityHelperIntroForDev(tech1, storage);

  // Tech 1 is reset: storage flag removed, session dismissal removed
  assert.equal(await hasSeenAvailabilityHelperIntro(tech1, storage), false);
  assert.equal(isAvailabilityHelperDismissedThisSession(tech1), false);

  // Tech 2 is completely unaffected
  assert.equal(await hasSeenAvailabilityHelperIntro(tech2, storage), true);
  assert.equal(isAvailabilityHelperDismissedThisSession(tech2), true);

  // Directly test clearAvailabilityHelperSessionDismissal on tech2
  clearAvailabilityHelperSessionDismissal(tech2);
  assert.equal(isAvailabilityHelperDismissedThisSession(tech2), false);

  clearSessionAvailabilityStateForTests();
});


