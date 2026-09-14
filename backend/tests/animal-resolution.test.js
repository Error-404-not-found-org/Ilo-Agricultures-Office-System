import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Animal } from "../src/models/animal.model.js";
import { User } from "../src/models/user.model.js";
import * as resolver from "../src/services/animal-resolution.service.js";

let farmerA;
let farmerB;

before(async () => {
  const baseUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test_db";
  const isolatedUri = baseUri.replace(/\/[^/?]+(\?|$)/, "/test_db_animal_resolution$1");
  if (mongoose.connection.readyState === 0) await mongoose.connect(isolatedUri);
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  }
});

beforeEach(async () => {
  await Promise.all([Animal.deleteMany({}), User.deleteMany({})]);
  [farmerA, farmerB] = await User.create([
    { role: "farmer", name: "Farmer A", status: "active" },
    { role: "farmer", name: "Farmer B", status: "active" },
  ]);
});

const createAnimal = (farmerId, earTag, animalId) =>
  Animal.create({ farmerId, earTag, animalId, species: "Cattle", breed: "Brahman" });

test("Animal ear tags accept generated and manual values through 20 characters", () => {
  for (const earTag of ["01DP", "99DP", "100DP", "999DP", "MANUAL-TAG-123456789"]) {
    const animal = new Animal({ farmerId: new mongoose.Types.ObjectId(), animalId: `ANM-${earTag}`, earTag, species: "Cattle", breed: "Native" });
    assert.equal(animal.validateSync(), undefined);
  }
});

test("Animal ear tags reject values longer than 20 characters", () => {
  const animal = new Animal({ farmerId: new mongoose.Types.ObjectId(), animalId: "ANM-LONG", earTag: "MANUAL-TAG-1234567890", species: "Cattle", breed: "Native" });
  assert.match(animal.validateSync()?.errors?.earTag?.message || "", /20 characters or fewer/i);
});

test("animalId is authoritative and rejects a mismatched Farmer", async () => {
  assert.equal(typeof resolver.resolveAnimalContext, "function");
  const animal = await createAnimal(farmerA._id, "01DP", "A-1");
  assert.equal((await resolver.resolveAnimalContext({ animalId: animal._id, farmerId: farmerA._id })).id, animal.id);
  await assert.rejects(
    resolver.resolveAnimalContext({ animalId: animal._id, farmerId: farmerB._id }),
    (error) => error.code === "ANIMAL_FARMER_MISMATCH" && error.status === 400,
  );
});

test("Farmer-scoped normalized ear tag selects the correct herd animal", async () => {
  await createAnimal(farmerA._id, "01DP", "A-1");
  const animalB = await createAnimal(farmerB._id, "01DP", "B-1");
  const resolved = await resolver.resolveAnimalContext({ farmerId: farmerB._id, earTag: " 01dp " });
  assert.equal(resolved.id, animalB.id);
});

test("unscoped duplicate ear tag is ambiguous instead of selecting the first", async () => {
  await createAnimal(farmerA._id, "01DP", "A-1");
  await createAnimal(farmerB._id, "01DP", "B-1");
  await assert.rejects(
    resolver.resolveAnimalContext({ earTag: "01dp", allowUnscopedEarTag: true }),
    (error) => error.code === "AMBIGUOUS_EAR_TAG" && error.status === 409,
  );
});

test("same Farmer cannot create a case-variant duplicate while another Farmer can reuse the tag", async () => {
  await createAnimal(farmerA._id, "01DP", "A-1");
  await assert.rejects(createAnimal(farmerA._id, "01dp", "A-2"), (error) => error?.code === 11000);
  const animalB = await createAnimal(farmerB._id, "01dp", "B-1");
  assert.equal(animalB.normalizedEarTag, "01dp");
});
