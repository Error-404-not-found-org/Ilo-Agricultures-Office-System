import assert from "node:assert/strict";
import test from "node:test";
import { getAttachmentPickerOptions } from "../../../lib/attachmentPickerOptions.ts";

import {
  ATTACHMENT_LIMIT,
  ATTACHMENT_PAYLOAD_BUDGET_BYTES,
  getAttachmentPayloadError,
  mergeAttachmentImages,
  remainingAttachmentSlots,
} from "./attachmentSafety.ts";

const image = (id: string) => ({ uri: `file://${id}.jpg`, base64: `data:image/jpeg;base64,${id}`, assetKey: `id:${id}` });

test("Health and AI can add five gallery images in one selection", () => {
  const selected = mergeAttachmentImages([], [1, 2, 3, 4, 5].map((id) => image(String(id))));
  assert.equal(selected.length, 5);
  assert.equal(remainingAttachmentSlots(selected.length), 0);
  assert.equal(ATTACHMENT_LIMIT, 5);
});

test("attachment gallery is uncropped and limited to remaining slots; camera stays single", () => {
  assert.deepEqual(getAttachmentPickerOptions("library", 2), {
    mediaTypes: ["images"], allowsEditing: false, allowsMultipleSelection: true,
    selectionLimit: 2, quality: 0.7, base64: false,
  });
  assert.deepEqual(getAttachmentPickerOptions("camera", 2), {
    mediaTypes: ["images"], allowsEditing: false, allowsMultipleSelection: false,
    quality: 0.7, base64: false,
  });
});

test("three existing images leave two gallery slots and camera remains additive", () => {
  const existing = [image("1"), image("2"), image("3")];
  assert.equal(remainingAttachmentSlots(existing.length), 2);
  const selected = mergeAttachmentImages(existing, [image("4"), image("5"), image("6")]);
  assert.deepEqual(selected.map((item) => item.assetKey), ["id:1", "id:2", "id:3", "id:4", "id:5"]);
});

test("same asset ID is not added twice, but matching filenames do not cause rejection", () => {
  const existing = [image("1")];
  assert.equal(mergeAttachmentImages(existing, [image("1")]).length, 1);
  assert.equal(mergeAttachmentImages(existing, [{ ...image("2"), uri: "file://same-name.jpg" }]).length, 2);
});

test("complete encoded request body blocks oversized images before submit", () => {
  const large = "A".repeat(ATTACHMENT_PAYLOAD_BUDGET_BYTES);
  const healthPayload = { animalId: "animal", photos: [`data:image/jpeg;base64,${large}`], imageUrl: `data:image/jpeg;base64,${large}` };
  assert.match(getAttachmentPayloadError(healthPayload) || "", /too large/i);
  assert.equal(getAttachmentPayloadError({ animalId: "animal", photos: Array(5).fill(`data:image/jpeg;base64,${"A".repeat(1000)}`) }), null);
});
