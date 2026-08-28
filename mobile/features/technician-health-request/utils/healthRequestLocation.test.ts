import assert from "node:assert/strict";
import test from "node:test";

import {
  getTechnicianHealthLocationPresentation,
  shouldShowTechnicianHealthMapAction,
} from "./healthRequestLocation.ts";

test("confirmed human-readable farm location is preferred over coordinate text", () => {
  const result = getTechnicianHealthLocationPresentation({
    farmerId: {
      farmLocation: {
        isConfirmed: true,
        detectedAddress: "Brgy. Buray, Oton, Iloilo",
        latitude: 10.7006,
        longitude: 122.4662,
      },
      address: { barangay: "Old Barangay", city: "Old City" },
    },
    dispatch: {
      location: {
        barangayName: "Snapshot Barangay",
        municipalityName: "Snapshot Municipality",
      },
    },
  });

  assert.equal(result.humanReadableLocation, "Brgy. Buray, Oton, Iloilo");
  assert.deepEqual(result.coordinates, {
    latitude: 10.7006,
    longitude: 122.4662,
  });
  assert.equal(
    result.mapUrl,
    "https://www.google.com/maps/search/?api=1&query=10.7006,122.4662",
  );
  assert.doesNotMatch(result.humanReadableLocation, /10\.7006|122\.4662/);
});

test("request dispatch snapshot is the locality fallback", () => {
  const result = getTechnicianHealthLocationPresentation({
    dispatch: {
      location: {
        barangayName: "Cabugao Norte",
        municipalityName: "Santa Barbara",
        provinceName: "Iloilo",
      },
    },
    farmerId: {
      address: { barangay: "Legacy", city: "Legacy City" },
    },
  });

  assert.equal(
    result.humanReadableLocation,
    "Brgy. Cabugao Norte, Santa Barbara, Iloilo",
  );
  assert.equal(result.coordinates, null);
  assert.equal(result.mapUrl, null);
});

test("technician candidate locality projection stays ahead of mutable contact address", () => {
  const result = getTechnicianHealthLocationPresentation({
    barangay: "Snapshot Barangay",
    municipality: "Snapshot Municipality",
    farmerId: {
      address: { barangay: "Current Barangay", city: "Current City" },
    },
  });

  assert.equal(
    result.humanReadableLocation,
    "Brgy. Snapshot Barangay, Snapshot Municipality",
  );
});

test("contact address remains readable when no request snapshot exists", () => {
  const result = getTechnicianHealthLocationPresentation({
    farmerId: {
      address: {
        barangay: "Pakiad",
        city: "Oton",
        province: "Iloilo",
      },
    },
  });

  assert.equal(result.humanReadableLocation, "Brgy. Pakiad, Oton, Iloilo");
  assert.equal(result.mapUrl, null);
});

test("missing address and coordinates degrade without crashing", () => {
  assert.deepEqual(getTechnicianHealthLocationPresentation({}), {
    humanReadableLocation: "Location not provided",
    landmark: "",
    directionsNote: "",
    coordinates: null,
    mapUrl: null,
  });
});

test("map action is withheld for invalid coordinates", () => {
  for (const farmLocation of [
    { latitude: 10.7 },
    { latitude: Number.NaN, longitude: 122.5 },
    { latitude: 95, longitude: 122.5 },
    { latitude: 10.7, longitude: 200 },
  ]) {
    const result = getTechnicianHealthLocationPresentation({
      farmerId: { farmLocation },
    });
    assert.equal(result.coordinates, null);
    assert.equal(result.mapUrl, null);
  }
});

test("landmark and directions remain available without a map pin", () => {
  const result = getTechnicianHealthLocationPresentation({
    farmerId: {
      farmLocation: {
        landmark: "Near the barangay hall",
        directionsNote: "Use the east farm road",
      },
    },
  });

  assert.equal(result.humanReadableLocation, "Near the barangay hall");
  assert.equal(result.landmark, "Near the barangay hall");
  assert.equal(result.directionsNote, "Use the east farm road");
  assert.equal(result.mapUrl, null);
});

test("map action is operational for visit decisions but hidden after non-clinical responses", () => {
  const mapUrl =
    "https://www.google.com/maps/search/?api=1&query=10.7,122.5";

  assert.equal(
    shouldShowTechnicianHealthMapAction({ status: "pending" }, mapUrl),
    true,
  );
  assert.equal(
    shouldShowTechnicianHealthMapAction(
      { status: "resolved", handlingMethod: "farm_visit" },
      mapUrl,
    ),
    true,
  );
  assert.equal(
    shouldShowTechnicianHealthMapAction(
      { status: "resolved", handlingMethod: "advice" },
      mapUrl,
    ),
    false,
  );
  assert.equal(
    shouldShowTechnicianHealthMapAction(
      { status: "resolved", handlingMethod: "office_pickup" },
      mapUrl,
    ),
    false,
  );
});
