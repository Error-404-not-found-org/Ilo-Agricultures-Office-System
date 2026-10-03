import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const detailSource = fs.readFileSync(
  path.resolve(
    currentDirectory,
    "../../../app/(farmer)/health-request-detail.tsx",
  ),
  "utf8",
);

test("Farmer Health Request Detail refreshes canonical data whenever it regains focus", () => {
  assert.match(detailSource, /useFocusEffect/);
  assert.match(
    detailSource,
    /queryClient\.invalidateQueries\(\{[\s\S]*queryKey:\s*healthRequestKeys\.detail\(id\)[\s\S]*exact:\s*true[\s\S]*refetchType:\s*"active"/,
  );
});

test("Farmer Health Request Detail renders normalized Technician and schedule fields", () => {
  assert.match(detailSource, /request\.technicianDisplayName/);
  assert.match(
    detailSource,
    /request\.assignedTechnicianId\s*\|\|\s*request\.handledBy/,
  );
  assert.match(detailSource, /request\.scheduledDate/);
  assert.match(detailSource, /request\.visitPeriod/);
});
