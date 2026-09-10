import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import { AuditLog } from "../src/models/audit-log.model.js";
import { createAuditLog } from "../src/services/audit.service.js";

const id = () => new mongoose.Types.ObjectId();

test("shared AuditLog service recursively removes sensitive values and preserves accountability", async (t) => {
  const actorId = id();
  const entityId = id();
  const animalId = id();
  const requestId = id();
  const taskId = id();
  let persistedEntry;

  t.mock.method(AuditLog, "create", async (entry) => {
    persistedEntry = entry;
    return entry;
  });

  await createAuditLog({
    entityType: "HealthRequest",
    entityId,
    action: "status_changed",
    actorId,
    before: {
      status: "scheduled",
      email: "farmer@example.test",
      nested: { pushToken: "ExponentPushToken[secret]", requestId },
    },
    after: {
      status: "in-progress",
      phoneNumber: "09171234567",
      findings: "private clinical findings",
    },
    metadata: {
      animalId,
      requestId,
      taskId,
      role: "technician",
      reason: "Farmer requested cancellation",
      actingAdmin: "admin@example.test",
      targetUser: "farmer-target@example.test",
      error: "database.internal.example refused connection",
      password: "secret",
      temporaryPassword: "temporary-secret",
      otp: "123456",
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      clerkUserId: "user_clerk_secret",
      invitationId: "invitation_secret",
      nested: {
        linkedClerkId: "user_linked_secret",
        locationAddress: "Private farm address",
        status: "safe",
      },
    },
  });

  assert.equal(String(persistedEntry.actorId), String(actorId));
  assert.equal(String(persistedEntry.entityId), String(entityId));
  assert.equal(persistedEntry.entityType, "HealthRequest");
  assert.equal(persistedEntry.action, "status_changed");
  assert.equal(persistedEntry.before.status, "scheduled");
  assert.equal(String(persistedEntry.before.nested.requestId), String(requestId));
  assert.equal(persistedEntry.after.status, "in-progress");
  assert.equal(String(persistedEntry.metadata.animalId), String(animalId));
  assert.equal(String(persistedEntry.metadata.requestId), String(requestId));
  assert.equal(String(persistedEntry.metadata.taskId), String(taskId));
  assert.equal(persistedEntry.metadata.role, "technician");
  assert.equal(persistedEntry.metadata.reason, "Farmer requested cancellation");
  assert.equal(persistedEntry.metadata.nested.status, "safe");

  const serialized = JSON.stringify(persistedEntry);
  for (const secret of [
    "farmer@example.test",
    "admin@example.test",
    "farmer-target@example.test",
    "09171234567",
    "database.internal.example",
    "private clinical findings",
    "ExponentPushToken[secret]",
    "temporary-secret",
    "123456",
    "access-secret",
    "refresh-secret",
    "user_clerk_secret",
    "invitation_secret",
    "Private farm address",
  ]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});

test("real AuditLog schema sanitizes direct model writes while preserving livestock linkage", () => {
  const actorId = id();
  const inseminationId = id();
  const animalId = id();
  const farmerId = id();
  const taskId = id();
  const requestId = id();

  const document = new AuditLog({
    action: "RECORD_AI_SERVICE",
    actorId,
    entityType: "Insemination",
    entityId: inseminationId,
    metadata: {
      taskId,
      requestId,
      inseminationId,
      animalId,
      farmerId,
      attemptNumber: 2,
      status: "done",
      token: "secret-token",
      nested: { clerkId: "clerk-secret", notes: "private notes" },
    },
  });

  assert.equal(document.validateSync(), undefined);
  const persisted = document.toObject();
  assert.equal(String(persisted.actorId), String(actorId));
  assert.equal(String(persisted.entityId), String(inseminationId));
  assert.equal(String(persisted.metadata.taskId), String(taskId));
  assert.equal(String(persisted.metadata.requestId), String(requestId));
  assert.equal(String(persisted.metadata.inseminationId), String(inseminationId));
  assert.equal(String(persisted.metadata.animalId), String(animalId));
  assert.equal(String(persisted.metadata.farmerId), String(farmerId));
  assert.equal(persisted.metadata.attemptNumber, 2);
  assert.equal(persisted.metadata.status, "done");
  assert.equal(persisted.metadata.nested, undefined);
  assert.equal(JSON.stringify(persisted).includes("secret"), false);
});
