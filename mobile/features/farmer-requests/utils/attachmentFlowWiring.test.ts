import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url).href), "utf8");

test("Farmer Health and AI use attachment mode, remaining slots, and full-payload checks", () => {
  for (const path of ["../../../app/(farmer)/report-sickness/index.tsx", "../../../app/(farmer)/request-ai/index.tsx"]) {
    const form = source(path);
    assert.match(form, /pickAttachmentsFromSource\(source, remainingAttachmentSlots\(photos\.length\)\)/);
    assert.match(form, /mergeAttachmentImages\(prev,/);
    assert.match(form, /getAttachmentPayloadError\(/);
  }
});

test("single-photo profile crop and three-photo evidence flows stay separate", () => {
  const picker = source("../../../lib/imagePickerHelper.ts");
  const profile = source("../../farmer-profile/hooks/useFarmerProfile.ts");
  const observation = source("../../breeding/screens/BreedingObservationScreen.tsx");
  const pregnancy = source("../../breeding/screens/FarmerPregnancyReportScreen.tsx");
  assert.match(picker, /allowsEditing = true/);
  assert.match(profile, /pickImageFromSource\(source, \{ aspect: \[1, 1\], quality: 0\.7 \}\)/);
  assert.match(observation, /MAX_EVIDENCE_PHOTOS = 3/);
  assert.match(pregnancy, /MAX_EVIDENCE_PHOTOS = 3/);
});
