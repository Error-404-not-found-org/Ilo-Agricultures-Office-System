import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL as NodeURL } from "node:url";

const read = (path: string) => readFileSync(new NodeURL(path, import.meta.url), "utf8");

const createUserSource = read("../screens/CreateUserScreen.tsx");
const manageDispatchSource = read("../../../app/(admin)/manage-dispatch.tsx");
const requestDetailsSource = read("../../admin-requests/screens/AdminRequestDetailsScreen.tsx");
const bottomNavigatorSource = read("../../../app/components/AdminBottomNavigator.tsx");

test("Technician creation keeps Contact Address separate and offers Dispatch setup", () => {
  assert.match(createUserSource, /Contact Address/);
  assert.doesNotMatch(createUserSource, /Assigned Service Area/);
  assert.match(createUserSource, /Technician invitation sent/);
  assert.match(createUserSource, /Review Dispatch Settings/);
});

test("Admin Dispatch shows Technician-owned Receive Requests as read only", () => {
  assert.match(manageDispatchSource, /Receive Requests/);
  assert.match(manageDispatchSource, /Read only\. Technicians control/);
  assert.doesNotMatch(manageDispatchSource, /setAcceptsNewRequests|acceptsNewRequests:\s*!/);
});

test("Admin reassignment uses the dedicated endpoint and excludes field-service controls", () => {
  assert.match(requestDetailsSource, /\/admin\/requests\/\$\{type\}\/\$\{id\}\/reassign/);
  assert.doesNotMatch(
    requestDetailsSource,
    />\s*(Start Service|Complete Service|Record AI|Diagnose Pregnancy)\s*</,
  );
});

test("dead Admin quick-action modal is absent from the tab navigator", () => {
  assert.doesNotMatch(bottomNavigatorSource, /modalVisible|Admin Actions|ModalAction/);
});
