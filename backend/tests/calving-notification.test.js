import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Notification } from "../src/models/notification.model.js";
import axios from "axios";
import { onCalvingRecorded } from "../src/config/inngest.js";
import { recordCalving } from "../src/controllers/animals.controllers.js";
import { inngest } from "../src/config/inngest.js";
import { Calving } from "../src/models/calving.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";

const invokeInngest = async (eventData) => {
  let handlerFn;
  if (onCalvingRecorded && typeof onCalvingRecorded.fn === "function") {
    handlerFn = onCalvingRecorded.fn;
  } else if (onCalvingRecorded && typeof onCalvingRecorded === "function") {
    handlerFn = onCalvingRecorded;
  }

  if (!handlerFn) {
    throw new Error("Could not find inngest handler function");
  }

  const step = {
    run: async (name, cb) => await cb(),
    sleep: async () => { throw new Error("HALT"); },
    sleepUntil: async () => { throw new Error("HALT"); },
  };

  try {
    await handlerFn({ event: { data: eventData }, step });
  } catch (e) {
    if (e.message !== "HALT") throw e;
  }
};

const FARMER_ID = "507f1f77bcf86cd799439011";
const ANIMAL_ID = "507f1f77bcf86cd799439012";
const TECH1_ID = "507f1f77bcf86cd799439013";
const TECH2_ID = "507f1f77bcf86cd799439014";
const CALVING_ID = "507f1f77bcf86cd799439015";

test("calving notification inngest handler", async (t) => {
  // 1. farmer + live birth → technician in-app notification & push
  await t.test("Farmer live birth notifies pooled technicians", async (subT) => {
    const pushes = [];
    subT.mock.method(axios, "post", async (url, data) => { pushes.push(data); return { data: {} }; });

    subT.mock.method(User, "findById", async () => ({ _id: FARMER_ID, pushToken: "ExpoPushToken[farmer]" }));
    subT.mock.method(Animal, "findById", async () => ({ _id: ANIMAL_ID, earTag: "OTN-009" }));

    subT.mock.method(User, "find", async (q) => {
      if (q.role === "technician") {
        return [
          { _id: TECH1_ID, pushToken: "ExpoPushToken[tech1]" },
          { _id: TECH2_ID } // no push token
        ];
      }
      return [];
    });

    const notifications = [];
    subT.mock.method(Notification, "create", async (data) => notifications.push(data));

    await invokeInngest({
      animalId: ANIMAL_ID,
      farmerId: FARMER_ID,
      calvingId: CALVING_ID,
      outcome: "live_birth",
      numberOfCalves: 1,
      actorRole: "farmer",
    });

    assert.equal(notifications.length, 2, "Both technicians should get an in-app notification");
    assert.equal(notifications[0].recipientId, TECH1_ID);
    assert.equal(notifications[0].title, "Calving recorded");
    assert.equal(notifications[0].message, "OTN-009 has a new calving record. 1 living calf was recorded.");
    assert.equal(notifications[1].recipientId, TECH2_ID);

    assert.equal(pushes.length, 2, "Farmer and Tech1 should get push notifications");
    assert.equal(pushes[0].to, "ExpoPushToken[farmer]");
    assert.equal(pushes[1].to, "ExpoPushToken[tech1]");
    assert.equal(pushes[1].body, "The calving outcome was added to the animal record.");
  });

  // 2. technician-recorded calving → no pooled technician notification
  await t.test("Technician recording calving does not notify technicians", async (subT) => {
    subT.mock.method(User, "findById", async () => ({ _id: FARMER_ID, pushToken: "ExpoPushToken[farmer]" }));
    subT.mock.method(Animal, "findById", async () => ({ _id: ANIMAL_ID, earTag: "OTN-009" }));

    let techQueried = false;
    subT.mock.method(User, "find", async () => {
      techQueried = true;
      return [];
    });

    const notifications = [];
    subT.mock.method(Notification, "create", async (data) => notifications.push(data));

    const pushes = [];
    subT.mock.method(axios, "post", async (url, data) => { pushes.push(data); return { data: {} }; });

    await invokeInngest({
      animalId: ANIMAL_ID,
      farmerId: FARMER_ID,
      calvingId: CALVING_ID,
      outcome: "live_birth",
      numberOfCalves: 1,
      actorRole: "technician", // <--- TECHNICIAN
    });

    assert.equal(techQueried, false, "Should not query tech pool");
    assert.equal(notifications.length, 0, "No tech notifications");
    assert.equal(pushes.length, 1, "Farmer still gets their confirmation");
  });

  // 3. stillbirth/loss → correct notification wording
  await t.test("Stillbirth notification wording", async (subT) => {
    subT.mock.method(User, "findById", async () => ({ _id: FARMER_ID }));
    subT.mock.method(Animal, "findById", async () => ({ _id: ANIMAL_ID, earTag: "OTN-010" }));
    subT.mock.method(User, "find", async () => [{ _id: TECH1_ID }]);
    const notifications = [];
    subT.mock.method(Notification, "create", async (data) => notifications.push(data));
    subT.mock.method(axios, "post", async () => ({ data: {} }));

    await invokeInngest({
      animalId: ANIMAL_ID,
      farmerId: FARMER_ID,
      calvingId: CALVING_ID,
      outcome: "stillbirth",
      numberOfCalves: 0,
      actorRole: "farmer",
    });

    assert.equal(notifications[0].message, "A stillbirth was recorded for OTN-010.");
  });

  // 4. retry/duplicate calving does not produce duplicate notification event
  await t.test("Idempotency: duplicate calving skips inngest event", async (subT) => {
    subT.mock.method(Calving, "findOne", async () => ({ _id: CALVING_ID })); // Causes alreadyRecorded = true
    subT.mock.method(Animal, "findOne", async () => ({ _id: ANIMAL_ID, farmerId: FARMER_ID }));
    subT.mock.method(Pregnancy, "findOne", async () => ({ _id: "507f1f77bcf86cd799439016", pregnancyDiagnosis: { result: "Pregnant", date: new Date(Date.now() - 300*24*60*60*1000) } }));
    subT.mock.method(Insemination, "findOne", async () => ({ _id: "507f1f77bcf86cd799439017", inseminationDate: new Date(Date.now() - 310*24*60*60*1000) }));
    subT.mock.method(Calving, "create", async () => []);
    subT.mock.method(Animal, "findByIdAndUpdate", async () => ({}));
    subT.mock.method(Pregnancy, "updateOne", async () => ({}));
    subT.mock.method(Insemination, "updateOne", async () => ({}));
    subT.mock.method(AnimalTimelineEvent, "insertMany", async () => []);
    subT.mock.method(AuditLog, "create", async () => ({}));

    let eventSent = false;
    subT.mock.method(inngest, "send", async () => { eventSent = true; });

    const req = {
      body: { animalId: ANIMAL_ID, outcome: "live_birth", date: new Date(), calves: [{ earTag: "C1", sex: "M" }] },
      user: { _id: FARMER_ID, role: "farmer" },
      app: { get: () => ({ emit: () => {} }) }
    };
    const res = { status: () => res, json: () => {} };

    await recordCalving(req, res);
    assert.equal(eventSent, false, "Duplicate should not trigger inngest event");
  });
});
