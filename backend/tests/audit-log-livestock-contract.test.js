import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import mongoose from "mongoose";

import { AuditLog } from "../src/models/audit-log.model.js";

const id = () => new mongoose.Types.ObjectId();

const serializeThroughAuditSchema = (entry) => {
  const document = new AuditLog(entry);
  assert.equal(document.validateSync(), undefined);
  return AuditLog.hydrate(document.toObject()).toObject();
};

test("livestock official-service linkage survives the real AuditLog schema", () => {
  const actorId = id();
  const taskId = id();
  const requestId = id();
  const inseminationId = id();
  const animalId = id();
  const farmerId = id();
  const medicalRecordId = id();

  const entries = [
    {
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
      },
    },
    {
      action: "RESOLVE_HEALTH_REQUEST",
      actorId,
      entityType: "HealthRequest",
      entityId: requestId,
      metadata: {
        status: "resolved",
        taskId,
        healthRequestId: requestId,
        animalId,
        farmerId,
      },
    },
    {
      action: "CREATE_WALKIN_HEALTH",
      actorId,
      entityType: "HealthRequest",
      entityId: requestId,
      metadata: {
        medicalRecordId,
        healthRequestId: requestId,
        animalId,
        farmerId,
      },
    },
  ].map(serializeThroughAuditSchema);

  const [ai, resolvedHealth, walkInHealth] = entries;

  assert.equal(String(ai.actorId), String(actorId));
  assert.equal(ai.entityType, "Insemination");
  assert.equal(String(ai.entityId), String(inseminationId));
  assert.equal(String(ai.metadata.taskId), String(taskId));
  assert.equal(String(ai.metadata.requestId), String(requestId));
  assert.equal(String(ai.metadata.inseminationId), String(inseminationId));
  assert.equal(String(ai.metadata.animalId), String(animalId));

  assert.equal(String(resolvedHealth.actorId), String(actorId));
  assert.equal(resolvedHealth.entityType, "HealthRequest");
  assert.equal(String(resolvedHealth.entityId), String(requestId));
  assert.equal(String(resolvedHealth.metadata.taskId), String(taskId));
  assert.equal(
    String(resolvedHealth.metadata.healthRequestId),
    String(requestId),
  );
  assert.equal(String(resolvedHealth.metadata.animalId), String(animalId));

  assert.equal(String(walkInHealth.actorId), String(actorId));
  assert.equal(walkInHealth.entityType, "HealthRequest");
  assert.equal(String(walkInHealth.entityId), String(requestId));
  assert.equal(
    String(walkInHealth.metadata.medicalRecordId),
    String(medicalRecordId),
  );
  assert.equal(
    String(walkInHealth.metadata.healthRequestId),
    String(requestId),
  );
  assert.equal(String(walkInHealth.metadata.animalId), String(animalId));

  for (const entry of entries) {
    assert.equal(Object.hasOwn(entry, "details"), false);
    assert.equal(Object.hasOwn(entry, "actorType"), false);
    assert.equal(String(entry.metadata.farmerId), String(farmerId));
  }
});

test("unsupported AuditLog fields are stripped and affected writers use metadata", async () => {
  const stripped = serializeThroughAuditSchema({
    action: "RECORD_AI_SERVICE",
    actorId: id(),
    entityType: "Insemination",
    entityId: id(),
    details: { taskId: id() },
    actorType: "Technician",
  });

  assert.equal(Object.hasOwn(stripped, "details"), false);
  assert.equal(Object.hasOwn(stripped, "actorType"), false);

  const source = await readFile(
    new URL("../src/services/livestock-transaction.service.js", import.meta.url),
    "utf8",
  );

  const requiredMetadataFields = {
    RECORD_AI_SERVICE: [
      "taskId",
      "requestId",
      "inseminationId",
      "animalId",
      "farmerId",
    ],
    RESOLVE_HEALTH_REQUEST: [
      "taskId",
      "healthRequestId",
      "animalId",
      "farmerId",
    ],
    CREATE_WALKIN_HEALTH: [
      "medicalRecordId",
      "healthRequestId",
      "animalId",
      "farmerId",
    ],
  };

  for (const [action, fields] of Object.entries(requiredMetadataFields)) {
    const actionStart = source.indexOf('action: "' + action + '"');
    assert.notEqual(actionStart, -1, action);
    const callEnd = source.indexOf(");", actionStart);
    assert.notEqual(callEnd, -1, action);
    const block = source.slice(actionStart, callEnd);
    assert.equal(block.includes("metadata: {"), true, action);
    assert.equal(block.includes("details:"), false, action);
    assert.equal(block.includes("actorType:"), false, action);
    for (const field of fields) {
      assert.equal(block.includes(field), true, action + ": " + field);
    }
  }
});
