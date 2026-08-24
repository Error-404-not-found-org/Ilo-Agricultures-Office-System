import test from "node:test";
import assert from "node:assert/strict";
import { resolveDispatchNotificationMode, DISPATCH_NOTIFICATION_MODES } from "../src/domain/geographic/dispatchMode.js";
import { ENV } from "../src/config/env.js";

test("Dispatch Mode Parser", async (t) => {
  await t.test("missing mode defaults to targeted", () => {
    const original = ENV.DISPATCH_NOTIFICATION_MODE;
    ENV.DISPATCH_NOTIFICATION_MODE = undefined;
    assert.equal(resolveDispatchNotificationMode(undefined), DISPATCH_NOTIFICATION_MODES.TARGETED);
    assert.equal(resolveDispatchNotificationMode(null), DISPATCH_NOTIFICATION_MODES.TARGETED);
    assert.equal(resolveDispatchNotificationMode(""), DISPATCH_NOTIFICATION_MODES.TARGETED);
    ENV.DISPATCH_NOTIFICATION_MODE = original;
  });

  await t.test("invalid mode fails closed to targeted", () => {
    assert.equal(resolveDispatchNotificationMode("random"), DISPATCH_NOTIFICATION_MODES.TARGETED);
    assert.equal(resolveDispatchNotificationMode("LEGACY_2"), DISPATCH_NOTIFICATION_MODES.TARGETED);
  });

  await t.test("legacy resolves correctly", () => {
    assert.equal(resolveDispatchNotificationMode("legacy"), DISPATCH_NOTIFICATION_MODES.LEGACY);
    assert.equal(resolveDispatchNotificationMode("LEGACY"), DISPATCH_NOTIFICATION_MODES.LEGACY);
    assert.equal(resolveDispatchNotificationMode(" legacy "), DISPATCH_NOTIFICATION_MODES.LEGACY);
  });

  await t.test("observe resolves correctly", () => {
    assert.equal(resolveDispatchNotificationMode("observe"), DISPATCH_NOTIFICATION_MODES.OBSERVE);
    assert.equal(resolveDispatchNotificationMode("OBSERVE"), DISPATCH_NOTIFICATION_MODES.OBSERVE);
  });

  await t.test("targeted resolves correctly", () => {
    assert.equal(resolveDispatchNotificationMode("targeted"), DISPATCH_NOTIFICATION_MODES.TARGETED);
    assert.equal(resolveDispatchNotificationMode("TARGETED"), DISPATCH_NOTIFICATION_MODES.TARGETED);
  });
});
