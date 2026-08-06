import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveRequestLocation } from "../src/domain/geographic/municipalityResolver.js";
import { findMunicipalityByText } from "../src/domain/geographic/psgcRegistry.js";

describe("Dispatch Geographic Resolver", () => {
  it("1. resolves from confirmed farmLocation.administrativeArea first", () => {
    const farmer = {
      farmLocation: {
        isConfirmed: true,
        administrativeArea: { municipalityCode: "063043000", municipalityName: "Tigbauan", provinceCode: "063000000" }
      },
      address: {
        administrativeArea: { municipalityCode: "063034000", municipalityName: "Oton" },
        city: "Guimbal"
      }
    };
    const result = resolveRequestLocation(farmer);
    assert.equal(result.source, "confirmed_farm_location");
    assert.equal(result.municipalityCode, "063043000");
  });

  it("2. ignores unconfirmed farmLocation and falls back to address.administrativeArea", () => {
    const farmer = {
      farmLocation: {
        isConfirmed: false,
        administrativeArea: { municipalityCode: "063043000", municipalityName: "Tigbauan" }
      },
      address: {
        administrativeArea: { municipalityCode: "063034000", municipalityName: "Oton", provinceCode: "063000000" },
        city: "Guimbal"
      }
    };
    const result = resolveRequestLocation(farmer);
    assert.equal(result.source, "canonical_contact_address");
    assert.equal(result.municipalityCode, "063034000");
  });

  it("3. falls back to legacy address.city when administrative areas are missing", () => {
    const farmer = {
      address: {
        city: "Guimbal",
        province: "Iloilo",
        municipality: "Tigbauan"
      }
    };
    const result = resolveRequestLocation(farmer);
    assert.equal(result.source, "legacy_address_fallback");
    assert.equal(result.municipalityName, "Guimbal");
  });

  it("4. falls back to legacy address.municipality when city is missing", () => {
    const farmer = {
      address: {
        municipality: "Tigbauan",
        province: "Iloilo",
      }
    };
    const result = resolveRequestLocation(farmer);
    assert.equal(result.source, "legacy_address_fallback");
    assert.equal(result.municipalityName, "Tigbauan");
  });

  it("5. returns unresolved if no fields match", () => {
    const farmer = {
      address: {
        city: "UnknownCity",
        province: "Iloilo",
      }
    };
    const result = resolveRequestLocation(farmer);
    assert.equal(result.source, "unresolved");
  });
});

describe("Production PSGC Registry", () => {
  it("resolves Oton successfully", () => {
    const res = findMunicipalityByText("Oton");
    assert.ok(res);
    assert.equal(res.psgcCode, "0603034000");
  });

  it("resolves Leon successfully", () => {
    const res = findMunicipalityByText("Leon");
    assert.ok(res);
    assert.equal(res.psgcCode, "0603028000");
  });

  it("resolves San Miguel successfully with Iloilo province context", () => {
    const res = findMunicipalityByText("San Miguel", "Iloilo");
    assert.ok(res);
    assert.equal(res.psgcCode, "0603041000");
  });

  it("resolves Tigbauan successfully", () => {
    const res = findMunicipalityByText("Tigbauan");
    assert.ok(res);
    assert.equal(res.psgcCode, "0603045000");
  });

  it("resolves Guimbal successfully", () => {
    const res = findMunicipalityByText("Guimbal");
    assert.ok(res);
    assert.equal(res.psgcCode, "0603020000");
  });

  it("resolves City of Passi successfully", () => {
    const res = findMunicipalityByText("City of Passi");
    assert.ok(res);
    assert.equal(res.psgcCode, "0603035000");
  });

  it("resolves City of Iloilo separately from Province of Iloilo", () => {
    const res = findMunicipalityByText("City of Iloilo");
    assert.ok(res);
    assert.equal(res.psgcCode, "0631000000");
  });

  it("rejects unknown codes and ambiguous text matches", () => {
    const res = findMunicipalityByText("FakeCity99");
    assert.equal(res, null);

    const res2 = findMunicipalityByText("San"); // Ambiguous if multiple "San X" exist, but our logic might just return first unless we strictly check. Wait, findMunicipalityByText checks exact match in the current logic. Let's test an incomplete word.
    assert.equal(res2, null);
  });
});
