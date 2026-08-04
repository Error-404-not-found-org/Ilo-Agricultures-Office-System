import test from "node:test";
import assert from "node:assert/strict";
import { assertUserAccess, assertAdmin, assertTechnicianOrAdmin } from "../src/policies/user.policy.js";
import { assertAnimalAccess } from "../src/policies/animal.policy.js";
import { assertAIRequestAccess, assertHealthRequestAccess } from "../src/policies/request.policy.js";

const adminUser = { _id: "admin1", role: "admin" };
const technicianUser = { _id: "tech1", role: "technician" };
const farmerUser1 = { _id: "farmer1", role: "farmer" };
const farmerUser2 = { _id: "farmer2", role: "farmer" };

test("User Policy: assertUserAccess checks", () => {
  // Admins can access anyone
  assert.doesNotThrow(() => assertUserAccess(adminUser, farmerUser1));
  assert.doesNotThrow(() => assertUserAccess(adminUser, technicianUser));

  // Technicians can access farmers
  assert.doesNotThrow(() => assertUserAccess(technicianUser, farmerUser1));
  // Technicians cannot access admins
  assert.throws(() => assertUserAccess(technicianUser, adminUser), /Forbidden/);

  // Farmers can access themselves
  assert.doesNotThrow(() => assertUserAccess(farmerUser1, farmerUser1));
  // Farmers cannot access other farmers
  assert.throws(() => assertUserAccess(farmerUser1, farmerUser2), /Forbidden/);
});

test("User Policy: assertAdmin checks", () => {
  assert.doesNotThrow(() => assertAdmin(adminUser));
  assert.throws(() => assertAdmin(technicianUser), /Forbidden/);
  assert.throws(() => assertAdmin(farmerUser1), /Forbidden/);
});

test("User Policy: assertTechnicianOrAdmin checks", () => {
  assert.doesNotThrow(() => assertTechnicianOrAdmin(adminUser));
  assert.doesNotThrow(() => assertTechnicianOrAdmin(technicianUser));
  assert.throws(() => assertTechnicianOrAdmin(farmerUser1), /Forbidden/);
});

test("Animal Policy: assertAnimalAccess checks", () => {
  const animalOwnedByFarmer1 = { _id: "animal1", farmerId: "farmer1" };

  // Farmers can access their own animal
  assert.doesNotThrow(() => assertAnimalAccess(farmerUser1, animalOwnedByFarmer1));
  // Farmers cannot access another farmer's animal
  assert.throws(() => assertAnimalAccess(farmerUser2, animalOwnedByFarmer1), /access/);

  // Staff can access any animal
  assert.doesNotThrow(() => assertAnimalAccess(technicianUser, animalOwnedByFarmer1));
  assert.doesNotThrow(() => assertAnimalAccess(adminUser, animalOwnedByFarmer1));
});

test("Request Policy: assertAIRequestAccess checks", () => {
  const requestOwnedByFarmer1 = { _id: "req1", farmerId: "farmer1" };

  // Farmers can access their own AI request
  assert.doesNotThrow(() => assertAIRequestAccess(farmerUser1, requestOwnedByFarmer1));
  // Farmers cannot access other AI requests
  assert.throws(() => assertAIRequestAccess(farmerUser2, requestOwnedByFarmer1), /Forbidden/);

  // Staff can access any AI request
  assert.doesNotThrow(() => assertAIRequestAccess(technicianUser, requestOwnedByFarmer1));
  assert.doesNotThrow(() => assertAIRequestAccess(adminUser, requestOwnedByFarmer1));
});
