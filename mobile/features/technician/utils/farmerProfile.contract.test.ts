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

test("Farmer profile presents truthful summary and operational labels", () => {
  const source = read("app/(technician)/client.profile.tsx");
  assert.match(source, /Contact Information/);
  assert.match(source, /Farm Information/);
  assert.match(source, /Farmer Overview/);
  assert.match(source, /Farmer Records/);
  assert.match(source, /Active Requests/);
  assert.match(source, /Last Service You Recorded/);
  assert.match(source, /No completed service yet/);
  assert.match(source, />Records<\/Text>/);
  assert.match(source, /Overview/);
  assert.match(source, /Email Farmer/);
  assert.match(source, /View Location/);
  assert.match(source, /canTechnicianArchive/);
  assert.doesNotMatch(source, /Compliance|92%|Registered Cattle|Add Field Note|Field Notes|Member since|Message|Dela Cruz Farm|Client under your care/);
});

test("Farmer profile stacks contact and farm details and keeps overview icons distinct", () => {
  const source = read("app/(technician)/client.profile.tsx");
  assert.doesNotMatch(source, /Quick Actions/);
  assert.match(source, /Contact Information[\s\S]*Farm Information[\s\S]*Farmer Overview/);
  assert.match(source, /Phone size=\{16\}/);
  assert.match(source, /Mail size=\{16\}/);
  assert.match(source, /MapPin size=\{16\}/);
  assert.match(source, /color=\{item\.iconColor\}/);
});

test("profile-scoped Field Notes request uses Farmer ID and keeps Farmer fixed", () => {
  const source = read("app/(technician)/photo-notes.tsx");
  assert.match(source, /params: \{ farmerId: params\.farmerId \}/);
  assert.match(source, /farmerId: params\.farmerId \|\| newNote\.farmerId/);
  assert.match(source, /disabled=\{Boolean\(params\.taskId \|\| params\.farmerId\)\}/);
});

test("Farmer Records route scopes the official record query by Farmer ID", () => {
  const route = read("app/(technician)/(tabs)/technician.records.tsx");
  const hook = read("features/technician/hooks/useTechnicianRecords.ts");
  const recordsScreen = read("features/technician-records/screens/TechnicianRecordsScreen.tsx");
  assert.match(route, /farmerId/);
  assert.match(hook, /farmerId/);
  assert.match(hook, /getOfficialRecords\(api, \{ page: pageParam, limit: 25, farmerId \}\)/);
  assert.match(recordsScreen, /!farmerId && <TouchableOpacity/);
  assert.match(recordsScreen, /title="Records"/);
});

test("open Farmer options has an outside-tap dismissal target", () => {
  const source = read("app/(technician)/client.profile.tsx");
  assert.match(source, /accessibilityLabel="Close Farmer options"/);
  assert.match(source, /onPress=\{\(\) => setMenuVisible\(false\)\}/);
});

test("Farmer profile App Access area maps invitation states to truthful actions", () => {
  const source = read("app/(technician)/client.profile.tsx");
  // invitation_sent maps to Cancel Invitation
  assert.match(source, /accessStatus === "invitation_sent"\s*\?\s*\{\s*label:\s*"Cancel Invitation",\s*kind:\s*"cancel"/);
  // invitation_expired maps to Resend
  assert.match(source, /accessStatus === "invitation_expired"\s*\?\s*\{\s*label:\s*"Resend",\s*kind:\s*"resend"/);
  // no_app_account or profile_only with email maps to Send Invite
  assert.match(source, /\{\s*label:\s*"Send Invite",\s*kind:\s*"send"/);
  // missing email offers Add Email
  assert.match(source, /\{\s*label:\s*"Add Email",\s*kind:\s*"edit"/);
  // connected and blocked do not allow invitation actions
  assert.match(source, /canInvite = \["no_app_account", "profile_only", "invitation_sent", "invitation_expired"\]/);
});

test("Farmer profile Cancel Invitation flow prompts ConfirmationModal before revoking", () => {
  const source = read("app/(technician)/client.profile.tsx");
  assert.match(source, /ConfirmationModal/);
  assert.match(source, /visible=\{cancelModalVisible\}/);
  assert.match(source, /title="Cancel Invitation\?"/);
  assert.match(source, /message="The pending invitation will be revoked\. You can send a new one at any time\."/);
  assert.match(source, /confirmText="Cancel Invitation"/);
  assert.match(source, /cancelText="Keep Invitation"/);
  assert.match(source, /isDestructive/);
  assert.match(source, /cancelInvitationMutation\.mutateAsync\(farmerId\)/);
  assert.match(source, /toast\.success\(result\?\.message \|\| "Invitation cancelled\."\)/);
  assert.match(source, /The invitation could not be cancelled/);
});
