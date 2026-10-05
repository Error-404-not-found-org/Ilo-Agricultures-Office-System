import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveFarmerProfile,
  sendFarmerInvitation,
  cancelFarmerInvitation,
} from "./clients.service.ts";

test("Technician Mobile archive calls the guarded Farmer archive endpoint", async () => {
  let requestedPath = "";
  const api = {
    patch: async (path: string) => {
      requestedPath = path;
      return { data: { message: "Farmer archived" } };
    },
  } as Parameters<typeof archiveFarmerProfile>[0];
  const result = await archiveFarmerProfile(api, "507f1f77bcf86cd799439012");
  assert.equal(requestedPath, "/user/507f1f77bcf86cd799439012/technician-archive");
  assert.equal(result.message, "Farmer archived");
});

test("Technician Mobile sendFarmerInvitation posts to the invitation endpoint", async () => {
  let requestedPath = "";
  const api = {
    post: async (path: string) => {
      requestedPath = path;
      return { data: { message: "Invitation sent", appAccountStatus: "invitation_sent" } };
    },
  } as Parameters<typeof sendFarmerInvitation>[0];

  const result = await sendFarmerInvitation(api, "507f1f77bcf86cd799439012", false);
  assert.equal(requestedPath, "/user/507f1f77bcf86cd799439012/app-invitation");
  assert.equal(result.message, "Invitation sent");
  assert.equal(result.appAccountStatus, "invitation_sent");
});

test("Technician Mobile sendFarmerInvitation with resend true posts to the resend endpoint", async () => {
  let requestedPath = "";
  const api = {
    post: async (path: string) => {
      requestedPath = path;
      return { data: { message: "Invitation resent", appAccountStatus: "invitation_sent" } };
    },
  } as Parameters<typeof sendFarmerInvitation>[0];

  const result = await sendFarmerInvitation(api, "507f1f77bcf86cd799439012", true);
  assert.equal(requestedPath, "/user/507f1f77bcf86cd799439012/app-invitation/resend");
  assert.equal(result.message, "Invitation resent");
  assert.equal(result.appAccountStatus, "invitation_sent");
});

test("Technician Mobile cancelFarmerInvitation deletes the active invitation", async () => {
  let requestedPath = "";
  const api = {
    delete: async (path: string) => {
      requestedPath = path;
      return { data: { message: "Invitation cancelled.", appAccountStatus: "no_app_account" } };
    },
  } as Parameters<typeof cancelFarmerInvitation>[0];

  const result = await cancelFarmerInvitation(api, "507f1f77bcf86cd799439012");
  assert.equal(requestedPath, "/user/507f1f77bcf86cd799439012/app-invitation");
  assert.equal(result.message, "Invitation cancelled.");
  assert.equal(result.appAccountStatus, "no_app_account");
});
