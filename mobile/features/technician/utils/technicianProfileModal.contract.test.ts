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

test("Technician profile phone number and service barangay modal uses smooth fade transition and backdrop dismissal", () => {
  const source = read("app/(technician)/(tabs)/profile.tsx");

  // Uses smooth fade animation and full-screen translucent overlay
  assert.match(source, /visible=\{editMode !== null\}[\s\S]*animationType="fade"[\s\S]*presentationStyle="overFullScreen"[\s\S]*statusBarTranslucent[\s\S]*navigationBarTranslucent/);

  // Uses theme-aware modal backdrop
  assert.match(source, /backgroundColor:\s*colors\.modalBackdrop/);

  // Has outside-tap dismissal target
  assert.match(source, /onPress=\{\(\) => setEditMode\(null\)\}[\s\S]*style=\{StyleSheet\.absoluteFill\}/);

  // Features dual buttons (Cancel + Save Changes)
  assert.match(source, /variant="outline"[\s\S]*label="Cancel"[\s\S]*onPress=\{\(\) => setEditMode\(null\)\}/);
  assert.match(source, /variant="default"[\s\S]*label="Save Changes"[\s\S]*loading=\{mutation\.isPending\}/);

  // Features top icon badge for phone and barangay
  assert.match(source, /editMode === "phone"[\s\S]*?<Phone size=\{22\}/);
  assert.match(source, /<MapPin size=\{22\}/);
});

test("Technician profile address select options modal uses smooth fade transition and backdrop dismissal", () => {
  const source = read("app/(technician)/(tabs)/profile.tsx");

  // Select dropdown uses smooth fade and overFullScreen
  assert.match(source, /visible=\{selectModal\.visible\}[\s\S]*animationType="fade"[\s\S]*presentationStyle="overFullScreen"/);

  // Has outside-tap dismissal target for select modal
  assert.match(source, /onPress=\{\(\) => setSelectModal\(\{\s*\.\.\.selectModal,\s*visible:\s*false\s*\}\)\}[\s\S]*style=\{StyleSheet\.absoluteFill\}/);
});
