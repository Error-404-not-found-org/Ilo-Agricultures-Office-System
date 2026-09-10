import assert from "node:assert/strict";
import test from "node:test";

import { getAIRequestAttachmentUrls } from "./aiRequestAttachments.ts";

test("Technician AI detail keeps all unique Farmer request photos", () => {
  assert.deepEqual(
    getAIRequestAttachmentUrls({
      photos: [" photo-1 ", "photo-2", "photo-3"],
      imageUrl: "photo-1",
      attachments: { urls: ["photo-2", "photo-4"] },
    }),
    ["photo-1", "photo-2", "photo-3", "photo-4"],
  );
});

test("Technician AI detail supports historical imageUrl-only requests", () => {
  assert.deepEqual(
    getAIRequestAttachmentUrls({ imageUrl: "historical-photo" }),
    ["historical-photo"],
  );
});

test("Technician AI detail safely handles requests without images", () => {
  assert.deepEqual(getAIRequestAttachmentUrls({}), []);
});
