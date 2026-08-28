import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPreviousInseminationPayload,
  getPreviousAIDateBounds,
  getPreviousAIErrorMessage,
  validatePreviousAIDate,
} from "./previousAI.ts";

const basePayload = {
  farmerId: "farmer-1",
  animalId: "animal-1",
  animalDetails: null,
  inseminationDetails: {
    inseminationDate: "2024-08-26",
    time: "09:30",
    estrus: "Natural" as const,
    sireBreed: "Holstein",
    sireCode: "S-1",
    semenDosesUsed: 1,
    status: "done" as const,
  },
};

describe("previous AI contract", () => {
  it("builds both Previous AI entry-mode payloads", () => {
    assert.equal(
      buildPreviousInseminationPayload(basePayload, "history_only").entryMode,
      "history_only",
    );
    assert.equal(
      buildPreviousInseminationPayload(basePayload, "continue_tracking")
        .entryMode,
      "continue_tracking",
    );
  });

  it("uses the shared species minimum breeding age as the minimum date", () => {
    const bounds = getPreviousAIDateBounds(
      "2020-03-14T00:00:00.000Z",
      "Cattle",
      "Holstein",
      new Date(2026, 7, 26, 17),
    );

    assert.deepEqual(
      [
        bounds.minimumDate?.getFullYear(),
        bounds.minimumDate?.getMonth(),
        bounds.minimumDate?.getDate(),
      ],
      [2021, 2, 14],
    );
  });

  it("rejects AI on the birth date", () => {
    assert.equal(
      validatePreviousAIDate(
        new Date(2020, 2, 14),
        "2020-03-14",
        "Cattle",
        "Holstein",
        new Date(2026, 7, 26),
      ),
      "The insemination date is earlier than this animal's minimum breeding age.",
    );
  });

  it("allows the exact minimum breeding-age date", () => {
    assert.equal(
      validatePreviousAIDate(
        new Date(2021, 2, 14),
        "2020-03-14",
        "Cattle",
        "Holstein",
        new Date(2026, 7, 26),
      ),
      null,
    );
  });

  it("uses today as the maximum date and rejects a future date", () => {
    const now = new Date(2026, 7, 26, 23, 30);
    const bounds = getPreviousAIDateBounds(null, "Cattle", null, now);
    assert.deepEqual(
      [
        bounds.maximumDate.getFullYear(),
        bounds.maximumDate.getMonth(),
        bounds.maximumDate.getDate(),
      ],
      [2026, 7, 26],
    );
    assert.equal(
      validatePreviousAIDate(
        new Date(2026, 7, 27),
        null,
        "Cattle",
        null,
        now,
      ),
      "Previous AI date cannot be in the future.",
    );
  });

  it("preserves a backend continue-tracking conflict message", () => {
    const message = getPreviousAIErrorMessage({
      response: {
        data: {
          message: "A newer pregnancy record already exists for this animal.",
        },
      },
    });
    assert.equal(
      message,
      "A newer pregnancy record already exists for this animal.",
    );
  });
});