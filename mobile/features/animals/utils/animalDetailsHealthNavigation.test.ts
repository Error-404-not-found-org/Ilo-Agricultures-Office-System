import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url).href), "utf8");

test("active Farmer Animal Details passes the viewed animal to Report Health", () => {
  const route = source("../../../app/(farmer)/animal-details.tsx");
  const details = source("../screens/RoleAwareAnimalDetailsScreen.tsx");
  const reportButton = details.slice(
    details.lastIndexOf("<Button", details.indexOf("Report Health")),
    details.indexOf("</Button>", details.indexOf("Report Health")),
  );

  assert.match(route, /RoleAwareAnimalDetailsScreen id=\{id \|\| ""\} role="farmer"/);
  assert.match(reportButton, /pathname: "\/\(farmer\)\/report-sickness"/);
  assert.match(reportButton, /params: \{ animalId: animal\._id \}/);
});

test("Report Health preselects only a matching animal from the Farmer picker and tolerates no match", () => {
  const form = source("../../../app/(farmer)/report-sickness/index.tsx");
  assert.match(form, /useLocalSearchParams<\{[\s\S]*?animalId\?: string/);
  assert.match(form, /useFarmerAnimalsForHealthQuery\(\)/);
  assert.match(form, /if \(routeAnimalId && !selectedAnimal\)/);
  assert.match(form, /list\.find\([\s\S]*?animal\._id === routeAnimalId \|\| animal\.animalId === routeAnimalId/);
  assert.match(form, /if \(routeAnimal\) setSelectedAnimal\(routeAnimal\)/);
});

test("general Report Health entry supplies no animal and Request AI still passes its animal", () => {
  const home = source("../../farmer-dashboard/screens/FarmerHomeScreen.tsx");
  const details = source("../screens/RoleAwareAnimalDetailsScreen.tsx");
  assert.match(home, /router\.push\("\/\(farmer\)\/report-sickness"\)/);
  assert.match(details, /pathname: "\/\(farmer\)\/request-ai",\s*params: \{\s*animalId: animal\._id/);
});
