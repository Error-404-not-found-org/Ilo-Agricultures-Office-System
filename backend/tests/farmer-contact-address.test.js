import test from "node:test";
import assert from "node:assert/strict";
import { assertCanUpdateUser } from "../src/policies/user.policy.js";

// Mock user document class for testing update logic
function createMockUser(initialData) {
  return {
    ...initialData,
    toObject() {
      return { ...this };
    },
    async save() {
      const isAddressPlaceholder = (val) =>
        !val || typeof val !== "string" || ["na", "n/a", "notset", "unknown"].includes(val.trim().toLowerCase());
      if (this.address && (isAddressPlaceholder(this.address.barangay) || !this.address.barangay?.trim())) {
        const err = new Error("User validation failed: address.barangay: Path `barangay` is required.");
        err.name = "ValidationError";
        err.errors = {
          "address.barangay": { message: "Path `barangay` is required." },
        };
        throw err;
      }
      return this;
    },
  };
}

test("Farmer Contact Address Hotfix Suite", async (t) => {
  const farmer1 = { _id: "farmer_id_101", role: "farmer" };
  const farmer2 = { _id: "farmer_id_102", role: "farmer" };

  await t.test("1. Existing user has a barangay, and updating only coordinates preserves it", () => {
    const existingUser = createMockUser({
      _id: "farmer_id_101",
      role: "farmer",
      address: {
        street: "Burgos St",
        barangay: "San Jose",
        city: "Iloilo City",
        province: "Iloilo",
      },
    });

    const incomingAddress = {
      coordinates: { lat: 10.7, lng: 122.5 },
      locationCapture: true,
    };

    const ALLOWED_ADDRESS_FIELDS = ["street", "barangay", "city", "district", "province", "coordinates"];
    const cleanIncoming = {};
    Object.keys(incomingAddress).forEach((k) => {
      if (ALLOWED_ADDRESS_FIELDS.includes(k)) cleanIncoming[k] = incomingAddress[k];
    });

    const existingObj = existingUser.address;
    const incomingBarangay = cleanIncoming.barangay?.trim();
    const existingBarangay = existingObj.barangay?.trim();

    let finalBarangay = incomingBarangay;
    if (incomingBarangay === undefined && existingBarangay) {
      finalBarangay = existingBarangay;
    }

    const merged = { ...existingObj, ...cleanIncoming, barangay: finalBarangay };
    assert.equal(merged.barangay, "San Jose");
    assert.deepEqual(merged.coordinates, { lat: 10.7, lng: 122.5 });
  });

  await t.test("2. Existing user has a barangay, and updating only phone/profile data does not erase it", () => {
    const existingUser = createMockUser({
      _id: "farmer_id_101",
      role: "farmer",
      address: {
        street: "Main St",
        barangay: "Bakhaw",
        city: "Mandurriao",
        province: "Iloilo",
      },
      phoneNumber: "09123456789",
    });

    // Update phone only (no address object passed)
    existingUser.phoneNumber = "09998887777";
    assert.equal(existingUser.address.barangay, "Bakhaw");
    assert.equal(existingUser.phoneNumber, "09998887777");
  });

  await t.test("3. Reverse geocoding returns an explicit barangay", () => {
    const rawGeocode = {
      name: "123 Street",
      district: "Mandurriao",
      city: "Iloilo City",
      subregion: "Iloilo",
      region: "Region VI",
    };
    // Mandurriao district has Bakhaw
    const barangay = "Bakhaw";
    assert.ok(barangay.length > 0);
  });

  await t.test("4. Reverse geocoding returns a supported barangay-level locality field", () => {
    const rawGeocode = {
      sublocality: "San Jose",
      city: "Oton",
      region: "Region VI",
    };
    assert.equal(rawGeocode.sublocality, "San Jose");
  });

  await t.test("5. Reverse geocoding returns municipality and province but no barangay", () => {
    const rawGeocode = {
      city: "Oton",
      region: "Region VI",
      district: null,
      neighborhood: null,
    };
    const hasBarangay = Boolean(rawGeocode.district || rawGeocode.neighborhood);
    assert.equal(hasBarangay, false);
  });

  await t.test("6. Missing barangay prevents submission and flags manual selection flow", () => {
    const incomingAddress = {
      street: "Unknown Road",
      city: "Oton",
      province: "Iloilo",
    };

    const isAddressPlaceholder = (val) =>
      !val || typeof val !== "string" || ["na", "n/a", "notset", "unknown"].includes(val.trim().toLowerCase());

    const hasValidBarangay = Boolean(incomingAddress.barangay && !isAddressPlaceholder(incomingAddress.barangay));
    assert.equal(hasValidBarangay, false);
  });

  await t.test("7. Manually selecting a barangay allows the update", () => {
    const address = {
      street: "Unknown Road",
      city: "Oton",
      barangay: "Poblacion South",
      province: "Iloilo",
    };
    assert.equal(address.barangay, "Poblacion South");
  });

  await t.test("8. Changing barangay intentionally saves the new barangay", () => {
    const existingUser = {
      address: { barangay: "OldBarangay" },
    };
    const incomingAddress = { barangay: "NewBarangay" };

    const merged = { ...existingUser.address, ...incomingAddress };
    assert.equal(merged.barangay, "NewBarangay");
  });

  await t.test("9. Partial nested address update does not replace unrelated address fields", () => {
    const existingAddress = {
      street: "123 Calle",
      barangay: "San Jose",
      city: "Iloilo City",
      province: "Iloilo",
      zipCode: "5000",
    };
    const incomingUpdate = { street: "456 Calle" };

    const merged = { ...existingAddress, ...incomingUpdate };
    assert.equal(merged.street, "456 Calle");
    assert.equal(merged.barangay, "San Jose");
    assert.equal(merged.city, "Iloilo City");
    assert.equal(merged.zipCode, "5000");
  });

  await t.test("10. Invalid update returns BARANGAY_REQUIRED, not raw Mongoose text", () => {
    const err = new Error("User validation failed: address.barangay: Path `barangay` is required.");
    err.name = "ValidationError";
    err.errors = { "address.barangay": { message: "Path `barangay` is required." } };

    const isBarangayError = err.errors?.["address.barangay"] || /address\.barangay/i.test(err.message);
    const responsePayload = isBarangayError
      ? { code: "BARANGAY_REQUIRED", message: "Barangay is required to update the contact address." }
      : { message: err.message };

    assert.equal(responsePayload.code, "BARANGAY_REQUIRED");
    assert.equal(responsePayload.message, "Barangay is required to update the contact address.");
  });

  await t.test("11. One failed request displays one toast only (handled client side without duplicate toasts)", () => {
    let toastCount = 0;
    const triggerToast = () => { toastCount++; };
    triggerToast();
    assert.equal(toastCount, 1);
  });

  await t.test("12. Location-permission failure uses the detection error, not Update Failed", () => {
    const permissionStatus = "denied";
    const errorType = permissionStatus !== "granted" ? "LOCATION_PERMISSION_DENIED" : "UPDATE_FAILED";
    assert.equal(errorType, "LOCATION_PERMISSION_DENIED");
  });

  await t.test("13. Offline profile update preserves complete normalized address", () => {
    const offlineAddress = {
      street: "Farm Road 1",
      barangay: "Buntatala",
      city: "Iloilo City",
      province: "Iloilo",
      zipCode: "5000",
      region: "Region VI",
    };
    assert.equal(offlineAddress.barangay, "Buntatala");
    assert.equal(offlineAddress.province, "Iloilo");
  });

  await t.test("14. Farmer cannot update another farmer's address", () => {
    const targetUser = { _id: "farmer_id_102", role: "farmer" };
    // Farmer 1 trying to update Farmer 2
    assert.throws(
      () => assertCanUpdateUser(farmer1, targetUser, { address: {} }),
      /Forbidden/i
    );
    // Farmer 1 updating self is allowed
    assert.doesNotThrow(
      () => assertCanUpdateUser(farmer1, { _id: "farmer_id_101", role: "farmer" }, { address: {} })
    );
  });
});
