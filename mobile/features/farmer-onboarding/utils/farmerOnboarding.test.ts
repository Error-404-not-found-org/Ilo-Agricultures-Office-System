import assert from "node:assert/strict";
import test from "node:test";

import {
  getFarmerOnboardingDestination,
  getFarmerOnboardingHandoff,
  getNextFarmerOnboardingStep,
  hasSeenFarmerOnboarding,
  markFarmerOnboardingSeen,
} from "./farmerOnboarding.ts";

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
  };
};

test("a verified Farmer with unseen onboarding goes to onboarding", () => {
  assert.equal(getFarmerOnboardingDestination({ role: "farmer", isVerified: true, seen: false, isOnboardingRoute: false }), "/(farmer)/onboarding");
  assert.equal(getFarmerOnboardingDestination({ role: "farmer", isVerified: true, seen: false, isOnboardingRoute: true }), null);
});

test("a returning Farmer leaves the onboarding route for the dashboard", () => {
  assert.equal(getFarmerOnboardingDestination({ role: "farmer", isVerified: true, seen: true, isOnboardingRoute: true }), "/(farmer)/(tabs)");
  assert.equal(getFarmerOnboardingDestination({ role: "farmer", isVerified: true, seen: true, isOnboardingRoute: false }), null);
});

test("onboarding never intercepts verification or other roles", () => {
  assert.equal(getFarmerOnboardingDestination({ role: "farmer", isVerified: false, seen: false, isOnboardingRoute: false }), null);
  assert.equal(getFarmerOnboardingDestination({ role: "technician", isVerified: true, seen: false, isOnboardingRoute: false }), null);
  assert.equal(getFarmerOnboardingDestination({ role: "admin", isVerified: true, seen: false, isOnboardingRoute: false }), null);
});

test("completion is stored separately for each Farmer account", async () => {
  const storage = createStorage();
  assert.equal(await hasSeenFarmerOnboarding("farmer-a", storage), false);
  await markFarmerOnboardingSeen("farmer-a", storage);
  assert.equal(await hasSeenFarmerOnboarding("farmer-a", storage), true);
  assert.equal(await hasSeenFarmerOnboarding("farmer-b", storage), false);
});

test("storage failures do not trap the Farmer in an error state", async () => {
  const storage = {
    getItem: async (_key: string): Promise<string | null> => { throw new Error("storage unavailable"); },
    setItem: async (_key: string, _value: string): Promise<void> => { throw new Error("storage unavailable"); },
  };
  assert.equal(await hasSeenFarmerOnboarding("farmer-a", storage), false);
  await assert.doesNotReject(markFarmerOnboardingSeen("farmer-a", storage));
});

test("Next advances through four pages and the final action completes", () => {
  assert.equal(getNextFarmerOnboardingStep(0, 4), 1);
  assert.equal(getNextFarmerOnboardingStep(1, 4), 2);
  assert.equal(getNextFarmerOnboardingStep(2, 4), 3);
  assert.equal(getNextFarmerOnboardingStep(3, 4), null);
  assert.equal(getNextFarmerOnboardingStep(1, 2), null);
});

test("a returning Farmer sees profile loading only during the dashboard handoff", () => {
  const farmer = { farmerId: "farmer-a", seen: true };
  assert.equal(getFarmerOnboardingHandoff({ activeFarmerId: "farmer-a", onboarding: farmer, inFarmerGroup: false, isOnboardingRoute: false }), "loading-profile");
  assert.equal(getFarmerOnboardingHandoff({ activeFarmerId: "farmer-a", onboarding: farmer, inFarmerGroup: true, isOnboardingRoute: false }), "none");
});

test("finishing onboarding shows profile loading, but arriving at onboarding does not", () => {
  assert.equal(getFarmerOnboardingHandoff({ activeFarmerId: "farmer-a", onboarding: { farmerId: "farmer-a", seen: false }, inFarmerGroup: true, isOnboardingRoute: true }), "none");
  assert.equal(getFarmerOnboardingHandoff({ activeFarmerId: "farmer-a", onboarding: { farmerId: "farmer-a", seen: true }, inFarmerGroup: true, isOnboardingRoute: true }), "loading-profile");
});

test("account lookup and first-time onboarding navigation never claim the profile is loading", () => {
  assert.equal(getFarmerOnboardingHandoff({ activeFarmerId: undefined, onboarding: null, inFarmerGroup: false, isOnboardingRoute: false }), "none");
  assert.equal(getFarmerOnboardingHandoff({ activeFarmerId: "farmer-a", onboarding: null, inFarmerGroup: false, isOnboardingRoute: false }), "preparing");
  assert.equal(getFarmerOnboardingHandoff({ activeFarmerId: "farmer-a", onboarding: { farmerId: "farmer-b", seen: true }, inFarmerGroup: false, isOnboardingRoute: false }), "preparing");
  assert.equal(getFarmerOnboardingHandoff({ activeFarmerId: "farmer-a", onboarding: { farmerId: "farmer-a", seen: false }, inFarmerGroup: false, isOnboardingRoute: false }), "preparing");
});
