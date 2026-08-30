import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getAdminAnimalRegistrySummary,
  getAdminAnimals,
} from "../services/adminAnimals.service.ts";

const screen = readFileSync(
  new URL("../screens/AdminAnimalsScreen.tsx", import.meta.url),
  "utf8",
);
const hook = readFileSync(
  new URL("../hooks/useAdminAnimals.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("../services/adminAnimals.service.ts", import.meta.url),
  "utf8",
);
const details = readFileSync(
  new URL("../screens/AdminAnimalDetailsScreen.tsx", import.meta.url),
  "utf8",
);

test("Animals directory exposes the simplified registry hierarchy", () => {
  assert.match(screen, />\s*Animals\s*</);
  assert.doesNotMatch(screen, /Animals Directory/);
  assert.match(screen, /Total Animals/);
  assert.match(screen, /Confirmed Pregnant/);
  assert.match(screen, /Total Cattle/);
  assert.match(screen, /Available for Breeding/);
  assert.doesNotMatch(
    screen,
    /Registry Health Metrics|Duplicate Tags|Missing Breed|Missing DOB/,
  );
});

test("registry summary is fetched independently from list pagination and filters", () => {
  assert.match(service, /getAdminAnimalRegistrySummary/);
  assert.match(service, /params: \{ page: 1, limit: 1 \}/);
  assert.match(hook, /queryKey: \["admin-animals", "registry-summary"\]/);
  assert.match(hook, /registrySummary/);
});

test("directory keeps only species and reproductive status filters", () => {
  assert.match(screen, /label="Species"/);
  assert.match(screen, /label="Reproductive Status"/);
  assert.doesNotMatch(screen, /label="Breed"|label="Barangay"/);
  assert.match(service, /reproductiveStatus:/);
  assert.match(service, /species:/);
});

test("cards navigate by stable animal ID without a hidden long-press action", () => {
  assert.match(screen, /params: \{ id: item\._id \}/);
  assert.match(screen, /Owner:/);
  assert.match(screen, /item\.reproductiveStatus/);
  assert.doesNotMatch(screen, /onLongPress|Long press to archive/);
  assert.match(details, /Archive Animal/);
});

test("list filters use server pagination while registry totals remain unfiltered", async () => {
  const calls: Array<{
    url: string;
    config: { params: Record<string, unknown> };
  }> = [];
  const api = {
    get: async (url: string, config: { params: Record<string, unknown> }) => {
      calls.push({ url, config });
      return {
        data: {
          animals: [],
          total: 0,
          pages: 0,
          summary: { total: 42, cattle: 30, pregnant: 8, available: 17 },
        },
      };
    },
  };

  await getAdminAnimals(api as never, 3, "Maria", "Carabao", "Pregnant");
  const summary = await getAdminAnimalRegistrySummary(api as never);

  assert.deepEqual(calls[0], {
    url: "/animals/all",
    config: {
      params: {
        page: 3,
        limit: 10,
        search: "Maria",
        species: "Carabao",
        reproductiveStatus: "Pregnant",
      },
    },
  });
  assert.deepEqual(calls[1], {
    url: "/animals/all",
    config: { params: { page: 1, limit: 1 } },
  });
  assert.deepEqual(summary, {
    total: 42,
    cattle: 30,
    pregnant: 8,
    available: 17,
  });
});
