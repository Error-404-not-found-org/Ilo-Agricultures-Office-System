import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  AI_TECHNICIAN_NOTE_MAX_LENGTH,
  normalizeAICompletionFields,
  normalizeSemenDosesUsed,
  normalizeTechnicianNoteInput,
  normalizeVisitPeriod,
} from "../src/domain/ai-recording-fields.js";
import { Insemination } from "../src/models/insemination.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "..", "src", relativePath), "utf8");

const ids = {
  farmer: "507f1f77bcf86cd799439001",
  animal: "507f1f77bcf86cd799439002",
};

test("AI scheduling fields: visit periods accept canonical values and normalize casing", () => {
  assert.equal(normalizeVisitPeriod("morning"), "morning");
  assert.equal(normalizeVisitPeriod("afternoon"), "afternoon");
  assert.equal(normalizeVisitPeriod("  MoRnInG  "), "morning");
  assert.equal(normalizeVisitPeriod(undefined), undefined);
});

test("AI scheduling fields: unsupported visit periods are rejected", () => {
  for (const value of ["evening", "", "noon", 1]) {
    assert.throws(
      () => normalizeVisitPeriod(value),
      (error) => error.status === 400 && error.code === "INVALID_VISIT_PERIOD",
    );
  }
});

test("AI recording fields: semen dose input defaults and normalizes safely", () => {
  assert.equal(
    normalizeSemenDosesUsed(undefined, { defaultWhenOmitted: true }),
    1,
  );
  assert.equal(normalizeSemenDosesUsed(1), 1);
  assert.equal(normalizeSemenDosesUsed(3), 3);
  assert.equal(normalizeSemenDosesUsed(" 2 "), 2);
});

test("AI recording fields: invalid semen dose input is rejected", () => {
  for (const value of [0, -1, 1.5, Number.NaN, "one", "1.5", ""]) {
    assert.throws(
      () => normalizeSemenDosesUsed(value),
      (error) =>
        error.status === 400 && error.code === "INVALID_SEMEN_DOSES_USED",
    );
  }
});

test("AI recording fields: manual sire text is trimmed and required for completion", () => {
  assert.deepEqual(
    normalizeAICompletionFields({
      sireBreed: "  Brahman  ",
      sireCode: "  BR-001  ",
    }),
    {
      sireBreed: "Brahman",
      sireCode: "BR-001",
      semenDosesUsed: 1,
    },
  );

  for (const sireCode of [undefined, "", "   "]) {
    assert.throws(
      () =>
        normalizeAICompletionFields({
          sireBreed: "Brahman",
          sireCode,
        }),
      (error) => error.status === 400 && error.code === "SIRE_CODE_REQUIRED",
    );
  }

  assert.throws(
    () =>
      normalizeAICompletionFields({
        sireBreed: "   ",
        sireCode: "BR-001",
      }),
    (error) => error.status === 400 && error.code === "SIRE_BREED_REQUIRED",
  );
  assert.throws(
    () =>
      normalizeAICompletionFields({
        sireBreed: "B".repeat(101),
        sireCode: "BR-001",
      }),
    (error) => error.status === 400 && error.code === "SIRE_BREED_TOO_LONG",
  );
  assert.throws(
    () =>
      normalizeAICompletionFields({
        sireBreed: "Brahman",
        sireCode: "C".repeat(65),
      }),
    (error) => error.status === 400 && error.code === "SIRE_CODE_TOO_LONG",
  );
});

test("AI recording fields: technician note aliases normalize to one optional field", () => {
  assert.equal(
    normalizeTechnicianNoteInput({
      technicianNote: "  Line one\nLine two  ",
    }),
    "Line one\nLine two",
  );
  assert.equal(
    normalizeTechnicianNoteInput({ technicianNotes: "  Alias note  " }),
    "Alias note",
  );
  assert.equal(
    normalizeTechnicianNoteInput({ notes: "  Legacy mobile note  " }),
    "Legacy mobile note",
  );
  assert.equal(normalizeTechnicianNoteInput({ notes: "   \n  " }), undefined);
  assert.equal(normalizeTechnicianNoteInput({}), undefined);
});

test("AI recording fields: technician notes reject invalid types and excessive length", () => {
  for (const value of [1, true, {}, []]) {
    assert.throws(
      () => normalizeTechnicianNoteInput({ technicianNote: value }),
      (error) =>
        error.status === 400 && error.code === "INVALID_TECHNICIAN_NOTE",
    );
  }

  assert.throws(
    () =>
      normalizeTechnicianNoteInput({
        technicianNote: "N".repeat(AI_TECHNICIAN_NOTE_MAX_LENGTH + 1),
      }),
    (error) =>
      error.status === 400 && error.code === "TECHNICIAN_NOTE_TOO_LONG",
  );
  assert.equal(
    normalizeTechnicianNoteInput({
      technicianNote: "N".repeat(AI_TECHNICIAN_NOTE_MAX_LENGTH),
    }).length,
    AI_TECHNICIAN_NOTE_MAX_LENGTH,
  );
});

test("AI schema: new fields are optional for historical records and validate new values", () => {
  const visitPeriodPath = Insemination.schema.path("visitPeriod");
  const semenDosesPath = Insemination.schema.path("semenDosesUsed");
  assert.deepEqual(visitPeriodPath.enumValues, ["morning", "afternoon"]);
  assert.equal(Boolean(visitPeriodPath.isRequired), false);
  assert.equal(Boolean(semenDosesPath.isRequired), false);
  assert.equal(typeof semenDosesPath.defaultValue, "function");

  const historical = Insemination.hydrate({
    _id: "507f1f77bcf86cd799439003",
    farmerId: ids.farmer,
    animalId: ids.animal,
    status: "done",
    sireBreed: "Legacy Breed",
  }).toObject();
  assert.equal(historical.visitPeriod, undefined);
  assert.equal(historical.semenDosesUsed, undefined);
  assert.equal(historical.sireCode, undefined);
  assert.equal(historical.technicianNote, "");

  const newPending = new Insemination({
    farmerId: ids.farmer,
    animalId: ids.animal,
    status: "pending",
  });
  assert.equal(newPending.semenDosesUsed, undefined);

  const newCompleted = new Insemination({
    farmerId: ids.farmer,
    animalId: ids.animal,
    status: "done",
  });
  assert.equal(newCompleted.semenDosesUsed, 1);

  const valid = new Insemination({
    farmerId: ids.farmer,
    animalId: ids.animal,
    status: "done",
    visitPeriod: "AFTERNOON",
    semenDosesUsed: 2,
  });
  assert.equal(valid.validateSync(), undefined);
  assert.equal(valid.visitPeriod, "afternoon");

  const decimal = new Insemination({
    farmerId: ids.farmer,
    animalId: ids.animal,
    status: "done",
    semenDosesUsed: 1.5,
  });
  assert.ok(decimal.validateSync()?.errors?.semenDosesUsed);
});

test("AI completion paths share recording validation and contain no inventory mutation", () => {
  const aiController = source("controllers/ai-request.controllers.js");
  const technicianController = source("controllers/technician.controllers.js");
  const transactionService = source("services/livestock-transaction.service.js");

  assert.match(aiController, /normalizeAICompletionFields\(\{/);
  assert.match(
    technicianController,
    /semenDosesUsed: inseminationDetails\?\.semenDosesUsed/,
  );
  assert.match(
    transactionService,
    /export const completeInsemination[\s\S]*normalizeAICompletionFields\(updateData\)/,
  );
  assert.match(
    transactionService,
    /export const recordTechnicianAIService[\s\S]*normalizeAICompletionFields\(\{/,
  );
  assert.match(
    technicianController,
    /normalizeTechnicianNoteInput\([\s\S]*recordTechnicianAIService\(\{[\s\S]*technicianNote,/,
  );
  assert.match(
    aiController,
    /updateRequestStatus[\s\S]*normalizeTechnicianNoteInput\(req\.body\)[\s\S]*completeInsemination\(\{/,
  );
  assert.match(
    transactionService,
    /export const completeInsemination[\s\S]*normalizeTechnicianNoteInput\(updateData\)/,
  );
  assert.doesNotMatch(
    `${aiController}\n${technicianController}\n${transactionService}`,
    /semen.*(?:inventory|stock)|(?:inventory|stock).*semen/i,
  );
});
