import test from "node:test";
import assert from "node:assert/strict";
import { Insemination } from "../src/models/insemination.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Task } from "../src/models/task.model.js";
import { User } from "../src/models/user.model.js";
import { getTechnicianRequests } from "../src/controllers/technician.controllers.js";

function createMockRes() {
  let statusVal = 200;
  let jsonVal = null;
  const res = {
    status(code) {
      statusVal = code;
      return this;
    },
    json(data) {
      jsonVal = data;
      return this;
    },
    get statusVal() { return statusVal; },
    get jsonVal() { return jsonVal; }
  };
  return res;
}

test("Location-Aware Phase 4: getTechnicianRequests calculates Haversine distance and sorts", async () => {
  const originalFindAI = Insemination.find;
  const originalFindHealth = HealthRequest.find;
  const originalFindTask = Task.find;
  const originalFindUser = User.find;
  const originalCountAI = Insemination.countDocuments;
  const originalCountHealth = HealthRequest.countDocuments;
  const originalCountTask = Task.countDocuments;

  // Stubs
  User.find = () => ({
    select() {
      return Promise.resolve([{ _id: "farmer-1" }]);
    }
  });

  const mockFarmer1 = {
    _id: "farmer-1",
    name: "Juan dela Cruz",
    address: {
      barangay: "Poblacion",
      city: "Oton",
      province: "Iloilo",
      coordinates: { lat: 10.693, lng: 122.474 }
    },
    farmLocation: {
      latitude: 10.695,
      longitude: 122.478
    }
  };

  const mockFarmer2 = {
    _id: "farmer-2",
    name: "Maria Santos",
    address: {
      barangay: "Santa Clara",
      city: "Oton",
      province: "Iloilo"
    },
    farmLocation: null // Missing farm location
  };

  const mockAI = {
    _id: "ai-1",
    farmerId: mockFarmer1,
    animalId: { _id: "animal-1", earTag: "TAG-123" },
    status: "pending",
    createdAt: new Date("2026-06-01T00:00:00.000Z")
  };

  const mockHealth = {
    _id: "health-1",
    farmerId: mockFarmer2,
    animalId: { _id: "animal-2", earTag: "TAG-456" },
    status: "pending",
    createdAt: new Date("2026-06-02T00:00:00.000Z")
  };

  Insemination.find = () => ({
    populate() { return this; },
    lean() { return Promise.resolve([mockAI]); }
  });

  HealthRequest.find = () => ({
    populate() { return this; },
    lean() { return Promise.resolve([mockHealth]); }
  });

  Task.find = () => ({
    populate() { return this; },
    lean() { return Promise.resolve([]); }
  });
  Insemination.countDocuments = () => Promise.resolve(1);
  HealthRequest.countDocuments = () => Promise.resolve(1);
  Task.countDocuments = () => Promise.resolve(0);

  // Technician coordinates are at Oton Municipal Hall: 10.693, 122.474
  const req = {
    user: { _id: "507f1f77bcf86cd799439001", role: "technician" },
    query: {
      nearLat: "10.693",
      nearLng: "122.474",
      sortBy: "distance"
    }
  };
  const res = createMockRes();

  await getTechnicianRequests(req, res);

  assert.equal(res.statusVal, 200);
  const requests = res.jsonVal.requests;
  assert.equal(requests.length, 2);

  // First request should be the one with distance (mockAI)
  assert.equal(requests[0].id, "ai-1");
  // Second request should be the one without distance (mockHealth)
  assert.equal(requests[1].id, "health-1");

  // Restore
  Insemination.find = originalFindAI;
  HealthRequest.find = originalFindHealth;
  Task.find = originalFindTask;
  User.find = originalFindUser;
  Insemination.countDocuments = originalCountAI;
  HealthRequest.countDocuments = originalCountHealth;
  Task.countDocuments = originalCountTask;
});
