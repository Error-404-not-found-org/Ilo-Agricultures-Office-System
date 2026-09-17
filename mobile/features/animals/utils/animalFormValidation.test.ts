import assert from "node:assert/strict";
import test from "node:test";

import { hasAnimalFormErrors } from "./animalFormValidation.ts";

test("undefined error entries do not invalidate a completed animal form", () => {
  assert.equal(hasAnimalFormErrors({ earTag: undefined }), false);
});

test("a populated error entry invalidates the animal form", () => {
  assert.equal(
    hasAnimalFormErrors({ earTag: "Ear tag must be 20 characters or fewer." }),
    true,
  );
});
