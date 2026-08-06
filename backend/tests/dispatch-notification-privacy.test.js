import test from "node:test";
import assert from "node:assert/strict";
import { notifyDispatchRequestSubmitted } from "../src/services/dispatch-request-notification.service.js";
import { DISPATCH_NOTIFICATION_MODES } from "../src/domain/geographic/dispatchMode.js";
import { User } from "../src/models/user.model.js";
import { Notification } from "../src/models/notification.model.js";
import mongoose from "mongoose";
import crypto from "node:crypto";

test("Dispatch Notification Privacy", async (t) => {
  await t.test("Assert exact Technician metadata keys", async () => {
    // Mock the environment, User, and Notification
    const originalFind = User.find;
    const originalFindOneAndUpdate = Notification.findOneAndUpdate;
    
    User.find = () => ({
      lean: () => Promise.resolve([
        { 
          _id: new mongoose.Types.ObjectId(), 
          role: "technician", 
          status: "active", 
          deletedAt: null, 
          isVerified: true,
          dispatchProfile: { acceptsNewRequests: true, availabilityStatus: "available", serviceCapabilities: ["AI"], serviceMunicipalities: [{municipalityCode: "123"}] }
        }
      ])
    });

    let insertedNotification = null;
    Notification.findOneAndUpdate = async (query, update, options) => {
      const payload = update.$setOnInsert;
      if (payload.category === "dispatch") {
        insertedNotification = payload;
      }
      return { value: payload, lastErrorObject: { updatedExisting: false } };
    };

    const mockRequest = {
      _id: new mongoose.Types.ObjectId(),
      urgency: "high",
      dispatch: {
        location: {
          municipalityCode: "123",
          municipality: "Testville",
          barangayCode: "456",
          barangay: "Test Barangay"
        },
        stage: "local",
        resolutionStatus: "resolved"
      },
      // Some private data that shouldn't leak
      farmerNotes: "Some private notes",
      imageUrl: "http://example.com/image.jpg"
    };

    const mockAnimal = {
      earTag: "TAG-001",
      animalId: "ANM-001",
      farmerId: new mongoose.Types.ObjectId(),
    };

    const mockFarmer = {
      _id: new mongoose.Types.ObjectId(),
      name: "John Doe",
      email: "john@example.com",
      phoneNumber: "1234567890",
      address: {
        street: "123 Main St",
        city: "Testville"
      }
    };

    await notifyDispatchRequestSubmitted({
      request: mockRequest,
      requestType: "AI",
      animal: mockAnimal,
      farmer: mockFarmer,
    });

    // Check Technician metadata keys
    assert.ok(insertedNotification, "Notification should be inserted");
    const metadata = insertedNotification.metadata;

    const expectedKeys = [
      "requestId",
      "serviceType",
      "requestType",
      "urgency",
      "animalTag",
      "municipalityCode",
      "municipalityName",
      "barangayCode",
      "barangayName",
      "dispatchStage"
    ];

    const actualKeys = Object.keys(metadata);
    
    // Check for exact keys
    for (const key of expectedKeys) {
      assert.ok(actualKeys.includes(key), `Missing metadata key: ${key}`);
    }

    assert.equal(actualKeys.length, expectedKeys.length, "Metadata contains unexpected keys");

    // Prove absence of private data
    assert.equal(metadata.farmerName, undefined);
    assert.equal(metadata.farmerId, undefined);
    assert.equal(metadata.phone, undefined);
    assert.equal(metadata.email, undefined);
    assert.equal(metadata.street, undefined);
    assert.equal(metadata.imageUrl, undefined);
    assert.equal(metadata.symptoms, undefined);

    User.find = originalFind;
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  });
});
