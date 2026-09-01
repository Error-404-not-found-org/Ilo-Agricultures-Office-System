import assert from "node:assert/strict";
import test from "node:test";

import { getHealthRequestAttachmentUrls } from "../src/controllers/technician.controllers.js";

test("Technician Health request projection preserves unique Farmer photos", () => {
  assert.deepEqual(
    getHealthRequestAttachmentUrls({
      photos: [" photo-1 ", "photo-2", "photo-1"],
      imageUrl: "photo-2",
    }),
    ["photo-1", "photo-2"],
  );
});

test("Technician Health request projection supports historical imageUrl", () => {
  assert.deepEqual(
    getHealthRequestAttachmentUrls({ imageUrl: " historical-photo " }),
    ["historical-photo"],
  );
});

test("Technician Health request projection safely handles no photos", () => {
  assert.deepEqual(getHealthRequestAttachmentUrls({}), []);
});
