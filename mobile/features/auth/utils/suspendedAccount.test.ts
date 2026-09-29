import assert from "node:assert/strict";
import test from "node:test";
import { getBootstrapErrorPresentation } from "./bootstrapError.ts";
import {
  clearSuspendedAccount,
  getSuspendedAccount,
  handleSuspendedApiError,
  isClerkBannedError,
  getSafeClerkErrorDiagnostic,
  getSafeOAuthOutcomeDiagnostic,
  signOutFromSuspendedAccount,
  setSuspendedAccount,
  subscribeSuspendedAccount,
} from "./suspendedAccount.ts";

test("backend suspension has the dedicated blocked-account presentation", () => {
  const result = getBootstrapErrorPresentation({
    status: 403,
    code: "ACCOUNT_SUSPENDED",
    message: "Account has been suspended.",
    retryable: false,
  });
  assert.deepEqual(result, {
    title: "Account suspended",
    message: "Your BreedSmart account has been suspended. Please contact the Municipal Agriculture Office for assistance.",
    primaryAction: "sign-out",
    primaryActionLabel: "Sign out",
  });
});

test("an authenticated backend suspension blocks the app on any protected request", () => {
  clearSuspendedAccount();
  assert.equal(handleSuspendedApiError({ response: { status: 403, data: { code: "ACCOUNT_SUSPENDED" } } }), true);
  assert.equal(getSuspendedAccount(), true);
  clearSuspendedAccount();
});

test("ordinary backend and network failures do not suspend the app", () => {
  clearSuspendedAccount();
  assert.equal(handleSuspendedApiError({ response: { status: 403, data: { code: "FORBIDDEN" } } }), false);
  assert.equal(handleSuspendedApiError({ message: "Network Error" }), false);
  assert.equal(getSuspendedAccount(), false);
});

test("generic forbidden account failure is not mislabeled as suspension", () => {
  const result = getBootstrapErrorPresentation({
    status: 403,
    code: "ACCOUNT_DELETED",
    message: "Account deactivated.",
    retryable: false,
  });
  assert.notEqual(result.title, "Account suspended");
});

test("only Clerk's banned-user code enters suspended access", () => {
  assert.equal(isClerkBannedError({ errors: [{ code: "user_banned" }] }), true);
  assert.equal(isClerkBannedError({ errors: [{ code: "form_password_incorrect" }] }), false);
  assert.equal(isClerkBannedError({ errors: [{ code: "network_error" }] }), false);
  assert.equal(isClerkBannedError({ message: "User banned" }), false);
});

test("development diagnostic reports structured Clerk fields without account identifiers", () => {
  const error = Object.assign(new Error("User farmer.test@example.com banned"), {
    name: "ClerkAPIResponseError",
    status: 403,
    errors: [{ code: "user_banned", message: "User farmer.test@example.com banned", longMessage: "Contact farmer.test@example.com", meta: { token: "secret" } }],
  });
  const result = getSafeClerkErrorDiagnostic(error);
  assert.equal(result.name, "ClerkAPIResponseError");
  assert.equal(result.status, 403);
  assert.equal(result.errors[0]?.code, "user_banned");
  assert.equal(JSON.stringify(result).includes("farmer.test@example.com"), false);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("development diagnostic shows nested response codes without logging response data", () => {
  const result = getSafeClerkErrorDiagnostic({
    response: {
      status: 403,
      data: { errors: [{ code: "user_banned", message: "User farmer.test@example.com banned" }], token: "secret" },
    },
  });
  assert.equal(result.responseStatus, 403);
  assert.equal(result.responseErrors[0]?.code, "user_banned");
  assert.equal(JSON.stringify(result).includes("farmer.test@example.com"), false);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("OAuth diagnostic shows callback error fields without nonce or full URL", () => {
  const result = getSafeOAuthOutcomeDiagnostic({
    createdSessionId: "sess_secret",
    authSessionResult: {
      type: "success",
      url: "ilo-agriculture://sso-callback?error=access_denied&reason=user_banned&rotating_token_nonce=private-nonce",
    },
  });
  assert.equal(result.type, "success");
  assert.equal(result.reason, "user_banned");
  assert.equal(result.hasSession, true);
  assert.equal(JSON.stringify(result).includes("private-nonce"), false);
  assert.equal(JSON.stringify(result).includes("sess_secret"), false);
});

test("suspension stays blocked until sign-out clears it", () => {
  clearSuspendedAccount();
  const snapshots: boolean[] = [];
  const unsubscribe = subscribeSuspendedAccount(() => snapshots.push(getSuspendedAccount()));
  setSuspendedAccount();
  assert.equal(getSuspendedAccount(), true);
  clearSuspendedAccount();
  assert.equal(getSuspendedAccount(), false);
  assert.deepEqual(snapshots, [true, false]);
  unsubscribe();
});

test("successful sign-out clears the block for reactivated sign-in", async () => {
  setSuspendedAccount();
  await signOutFromSuspendedAccount(async () => {});
  assert.equal(getSuspendedAccount(), false);
});

test("failed sign-out keeps protected access blocked", async () => {
  setSuspendedAccount();
  await assert.rejects(signOutFromSuspendedAccount(async () => { throw new Error("Sign out failed"); }));
  assert.equal(getSuspendedAccount(), true);
  clearSuspendedAccount();
});
