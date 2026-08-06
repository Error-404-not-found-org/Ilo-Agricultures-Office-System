import test from "node:test";
import assert from "node:assert/strict";
import { resolveDispatchRecipients } from "../src/services/dispatch-recipient.service.js";
import { DISPATCH_NOTIFICATION_MODES } from "../src/domain/geographic/dispatchMode.js";
import { User } from "../src/models/user.model.js";
import mongoose from "mongoose";

test("Dispatch Recipient Resolution", async (t) => {

  await t.test("Legacy mode selects all legacy technicians", async () => {
    const tech = new User({
      name: "Legacy Tech",
      role: "technician",
      status: "active",
      deletedAt: null,
      isVerified: true
    });
    // In a real isolated unit test, we should mock User.find().lean()
    // For now we will mock the mongoose model directly.
    const originalFind = User.find;
    User.find = () => ({
      lean: () => Promise.resolve([
        { _id: "1", role: "technician", status: "active", deletedAt: null, isVerified: true },
        { _id: "2", role: "technician", status: "suspended", deletedAt: null, isVerified: true },
        { _id: "3", role: "technician", status: "active", deletedAt: new Date(), isVerified: true }
      ])
    });

    const result = await resolveDispatchRecipients({
      requestType: "AI",
      dispatchLocation: { municipalityCode: "123" },
      dispatchStage: "local",
      notificationMode: DISPATCH_NOTIFICATION_MODES.LEGACY
    });

    assert.equal(result.legacyRecipients.length, 1);
    assert.equal(result.selectedRecipients.length, 1);
    assert.equal(result.selectedRecipients[0]._id, "1");

    User.find = originalFind;
  });

  await t.test("Observe mode calculates eligible recipients but selects legacy cohort", async () => {
    const originalFind = User.find;
    User.find = () => ({
      lean: () => Promise.resolve([
        { 
          _id: "1", role: "technician", status: "active", deletedAt: null, isVerified: true,
          dispatchProfile: { acceptsNewRequests: true, availabilityStatus: "available", serviceCapabilities: ["AI"], serviceMunicipalities: [{municipalityCode: "123"}] }
        },
        { 
          _id: "2", role: "technician", status: "active", deletedAt: null, isVerified: true,
          dispatchProfile: { acceptsNewRequests: true, availabilityStatus: "available", serviceCapabilities: ["HEALTH"], serviceMunicipalities: [{municipalityCode: "123"}] }
        },
      ])
    });

    const result = await resolveDispatchRecipients({
      requestType: "AI",
      dispatchLocation: { municipalityCode: "123" },
      dispatchStage: "local",
      notificationMode: DISPATCH_NOTIFICATION_MODES.OBSERVE
    });

    assert.equal(result.legacyRecipients.length, 2);
    assert.equal(result.eligibleLocalRecipients.length, 1);
    assert.equal(result.selectedRecipients.length, 2);
    
    User.find = originalFind;
  });

  await t.test("Targeted mode selects only eligible local technicians", async () => {
    const originalFind = User.find;
    User.find = () => ({
      lean: () => Promise.resolve([
        { 
          _id: "1", role: "technician", status: "active", deletedAt: null, isVerified: true,
          dispatchProfile: { acceptsNewRequests: true, availabilityStatus: "available", serviceCapabilities: ["AI"], serviceMunicipalities: [{municipalityCode: "123"}] }
        },
        { 
          _id: "2", role: "technician", status: "active", deletedAt: null, isVerified: true,
          dispatchProfile: { acceptsNewRequests: true, availabilityStatus: "available", serviceCapabilities: ["HEALTH"], serviceMunicipalities: [{municipalityCode: "123"}] }
        },
      ])
    });

    const result = await resolveDispatchRecipients({
      requestType: "AI",
      dispatchLocation: { municipalityCode: "123" },
      dispatchStage: "local",
      notificationMode: DISPATCH_NOTIFICATION_MODES.TARGETED
    });

    assert.equal(result.selectedRecipients.length, 1);
    assert.equal(result.selectedRecipients[0]._id, "1");

    User.find = originalFind;
  });

});
