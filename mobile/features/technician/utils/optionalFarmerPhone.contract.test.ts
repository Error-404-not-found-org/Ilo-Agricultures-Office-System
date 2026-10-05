import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (relativePath: string) => {
  const rootPath = resolve(process.cwd(), relativePath);
  const mobilePath = resolve(process.cwd(), "mobile", relativePath);
  try {
    return readFileSync(rootPath, "utf8");
  } catch {
    return readFileSync(mobilePath, "utf8");
  }
};

test("Technician Mobile registration treats phone as optional and omits blank values", () => {
  const source = read("app/(technician)/register-client.tsx");
  assert.match(source, /Phone Number \(Optional\)/);
  assert.match(source, /if \(formData\.phoneNumber\.trim\(\) && !\/\^09\\d\{9\}\$\//);
  assert.match(source, /\.\.\.\(formData\.phoneNumber\.trim\(\)\s*\? \{ phoneNumber: formData\.phoneNumber\.trim\(\) \}\s*: \{\}\)/s);
  assert.doesNotMatch(source, /verify this phone number to access their records/);
});

test("Technician Mobile edit allows adding an optional phone without sending nested empty phone", () => {
  const source = read("app/(technician)/updateclient.profile.tsx");
  assert.match(source, /Phone Number \(Optional\)/);
  assert.match(source, /formData\.phoneNumber\.trim\(\) &&/);
  assert.match(source, /\.\.\.\(formData\.phoneNumber\.trim\(\)\s*\? \{ phoneNumber: formData\.phoneNumber\.trim\(\) \}\s*: \{\}\)/s);
});

test("Technician Farmer payload types permit an omitted phone", () => {
  const source = read("features/technician/services/clients.service.ts");
  assert.match(source, /phoneNumber\?: string;/);
});

test("Technician Farmer profile explains a missing phone without offering phone claiming", () => {
  const source = read("app/(technician)/client.profile.tsx");
  assert.match(source, /Phone not provided/);
  assert.doesNotMatch(source, /verify this phone/);
});
