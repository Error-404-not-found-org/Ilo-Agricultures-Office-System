import assert from "node:assert/strict";
import test from "node:test";
import { getBootstrapGateState } from "./bootstrapGateState.ts";

const establishedFarmer = {
  isSignedIn: true,
  dbUserId: "farmer-1",
  establishedOwnerId: "farmer-1",
  isBootstrapLoading: false,
  hasBootstrapError: false,
  isSuspended: false,
};

test("unresolved signed-in bootstrap shows initial loading without mounting navigation", () => {
  assert.equal(getBootstrapGateState({ ...establishedFarmer, dbUserId: undefined, establishedOwnerId: undefined, isBootstrapLoading: true }), "initial-loading");
  assert.equal(getBootstrapGateState({ ...establishedFarmer, dbUserId: "farmer-2", isBootstrapLoading: true }), "initial-loading");
});

test("fresh login becomes routable once its domain user and cache owner match, even if fetchedAfterMount resets", () => {
  assert.equal(getBootstrapGateState({ ...establishedFarmer, isBootstrapLoading: true }), "authenticated");
});

test("foreground fetching preserves an established Farmer navigator without blocking it", () => {
  assert.equal(getBootstrapGateState({ ...establishedFarmer, isBootstrapLoading: true }), "authenticated");
  assert.equal(getBootstrapGateState(establishedFarmer), "authenticated");
});

test("a temporary foreground failure keeps the established session mounted", () => {
  assert.equal(getBootstrapGateState({ ...establishedFarmer, hasBootstrapError: true, isTransientBootstrapError: true }), "authenticated");
  assert.equal(getBootstrapGateState({ ...establishedFarmer, dbUserId: undefined, establishedOwnerId: undefined, hasBootstrapError: true, isTransientBootstrapError: true }), "error");
});

test("suspension takes precedence during revalidation and initial bootstrap", () => {
  assert.equal(getBootstrapGateState({ ...establishedFarmer, isBootstrapLoading: true, isSuspended: true }), "suspended");
  assert.equal(getBootstrapGateState({ ...establishedFarmer, dbUserId: undefined, establishedOwnerId: undefined, isSuspended: true }), "suspended");
});

test("bootstrap failures retain the safe error gate, including after revalidation", () => {
  assert.equal(getBootstrapGateState({ ...establishedFarmer, hasBootstrapError: true }), "error");
  assert.equal(getBootstrapGateState({ ...establishedFarmer, isBootstrapLoading: true, hasBootstrapError: true }), "error");
});

test("signed-out navigation is not delayed by bootstrap state", () => {
  assert.equal(getBootstrapGateState({ ...establishedFarmer, isSignedIn: false, dbUserId: undefined, establishedOwnerId: undefined, isBootstrapLoading: true }), "content");
});
