import test from "node:test";
import assert from "node:assert/strict";
import { notifyDispatchRequestSubmitted } from "../src/services/dispatch-request-notification.service.js";
import { ENV } from "../src/config/env.js";
import { DISPATCH_NOTIFICATION_MODES } from "../src/domain/geographic/dispatchMode.js";
import { User } from "../src/models/user.model.js";
import { Notification } from "../src/models/notification.model.js";
import mongoose from "mongoose";

test("Dispatch Notification Targeting", async (t) => {
  const mockRequest = {
    _id: new mongoose.Types.ObjectId(),
    urgency: "high",
    dispatch: {
      location: {
        municipalityCode: "123",
        municipality: "Testville",
      },
      stage: "local",
      resolutionStatus: "resolved"
    },
  };

  const mockAnimal = {
    earTag: "TAG-001",
    animalId: "ANM-001",
    farmerId: new mongoose.Types.ObjectId(),
  };

  const mockFarmer = {
    _id: new mongoose.Types.ObjectId(),
    name: "John Doe",
  };

  await t.test("No eligible local technician notifies Admin only in targeted mode", async () => {
    const originalFind = User.find;
    const originalFindOneAndUpdate = Notification.findOneAndUpdate;
    
    // No eligible technician
    User.find = (query) => ({
      lean: () => {
        if (query.role === "admin") {
          return Promise.resolve([
            { _id: new mongoose.Types.ObjectId(), role: "admin", status: "active", deletedAt: null }
          ]);
        }
        return Promise.resolve([
          { 
            _id: new mongoose.Types.ObjectId(), 
            role: "technician", 
            status: "active", 
            deletedAt: null, 
            isVerified: true,
            dispatchProfile: { acceptsNewRequests: true, availabilityStatus: "available", serviceCapabilities: ["HEALTH"], serviceMunicipalities: [{municipalityCode: "999"}] } // mismatch
          }
        ]);
      }
    });

    const notificationsSent = [];
    Notification.findOneAndUpdate = async (query, update, options) => {
      notificationsSent.push(update.$setOnInsert);
      return { value: update.$setOnInsert, lastErrorObject: { updatedExisting: false } };
    };

    ENV.DISPATCH_NOTIFICATION_MODE = "targeted";

    const result = await notifyDispatchRequestSubmitted({
      request: mockRequest,
      requestType: "AI",
      animal: mockAnimal,
      farmer: mockFarmer,
    });

    assert.equal(result.noLocalRecipient, true);
    assert.equal(result.deliveredRecipientIds.length, 0);
    assert.equal(result.adminDeliveredRecipientIds.length, 1);
    
    // Only one admin notification
    assert.equal(notificationsSent.length, 1);
    assert.equal(notificationsSent[0].category, "admin_summary");

    User.find = originalFind;
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
    ENV.DISPATCH_NOTIFICATION_MODE = "observe";
  });

  await t.test("Deduplication prevents multiple pushes", async () => {
    const originalFind = User.find;
    const originalFindOneAndUpdate = Notification.findOneAndUpdate;
    
    User.find = (query) => ({
      lean: () => {
        if (query.role === "admin") return Promise.resolve([]);
        return Promise.resolve([
          { 
            _id: new mongoose.Types.ObjectId(), 
            role: "technician", 
            status: "active", 
            deletedAt: null, 
            isVerified: true,
            dispatchProfile: { acceptsNewRequests: true, availabilityStatus: "available", serviceCapabilities: ["AI"], serviceMunicipalities: [{municipalityCode: "123"}] }
          }
        ]);
      }
    });

    // Simulate already exists
    Notification.findOneAndUpdate = async (query, update, options) => {
      return { value: update.$setOnInsert, lastErrorObject: { updatedExisting: true } }; // updatedExisting = true prevents push
    };

    ENV.DISPATCH_NOTIFICATION_MODE = "targeted";

    const result = await notifyDispatchRequestSubmitted({
      request: mockRequest,
      requestType: "AI",
      animal: mockAnimal,
      farmer: mockFarmer,
    });

    assert.equal(result.deliveredRecipientIds.length, 1, "Delivered is tracked even if already inserted");

    User.find = originalFind;
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
    ENV.DISPATCH_NOTIFICATION_MODE = "observe";
  });
});
