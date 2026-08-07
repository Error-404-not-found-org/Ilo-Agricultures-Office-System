import assert from "node:assert/strict";
import test from "node:test";

import { updateRequestStatus } from "../src/controllers/ai-request.controllers.js";
import {
  presentNotificationCopy,
  visitScheduleLabel,
} from "../src/domain/notification-presentation.js";
import { ENV } from "../src/config/env.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Notification } from "../src/models/notification.model.js";
import { User } from "../src/models/user.model.js";
import {
  notifyDispatchRequestSubmitted,
  resolveDispatchDisplayLocation,
} from "../src/services/dispatch-request-notification.service.js";

const populatedQuery = (value) => {
  const query = {
    populate() {
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
};

const installDispatchHarness = (t) => {
  const originals = {
    find: User.find,
    findOneAndUpdate: Notification.findOneAndUpdate,
    mode: ENV.DISPATCH_NOTIFICATION_MODE,
  };
  t.after(() => {
    User.find = originals.find;
    Notification.findOneAndUpdate = originals.findOneAndUpdate;
    ENV.DISPATCH_NOTIFICATION_MODE = originals.mode;
  });

  const notifications = [];
  User.find = (query) => ({
    lean: async () =>
      query.role === "admin"
        ? []
        : [
            {
              _id: "507f1f77bcf86cd799439011",
              role: "technician",
              status: "active",
              deletedAt: null,
            },
          ],
  });
  Notification.findOneAndUpdate = async (_filter, update) => {
    notifications.push(update.$setOnInsert);
    return {
      value: update.$setOnInsert,
      lastErrorObject: { updatedExisting: false },
    };
  };
  ENV.DISPATCH_NOTIFICATION_MODE = "observe";
  return notifications;
};

const dispatchRequest = (id, location, resolutionStatus = "resolved") => ({
  _id: id,
  urgency: "normal",
  dispatch: {
    location,
    stage: "local",
    resolutionStatus,
  },
});

test("AI and Health submitted notifications use canonical barangay and municipality names", async (t) => {
  const notifications = installDispatchHarness(t);
  const farmer = { _id: "507f1f77bcf86cd799439012" };
  const animal = { earTag: "CB-014" };
  const location = {
    municipalityCode: "063034000",
    municipalityName: "Oton",
    barangayCode: "063034007",
    barangayName: "Buray",
  };

  for (const [requestType, requestId] of [
    ["AI", "507f1f77bcf86cd799439021"],
    ["HEALTH", "507f1f77bcf86cd799439022"],
  ]) {
    await notifyDispatchRequestSubmitted({
      request: dispatchRequest(requestId, location),
      requestType,
      animal,
      farmer,
    });
  }

  assert.equal(notifications.length, 2);
  for (const notification of notifications) {
    assert.equal(notification.metadata.municipalityName, "Oton");
    assert.equal(notification.metadata.barangayName, "Buray");
    assert.equal(notification.metadata.location, "Buray, Oton");
    assert.match(notification.title, /Buray, Oton/);
    assert.doesNotMatch(
      `${notification.title} ${notification.message}`,
      /unknown location/i,
    );
  }
});

test("legacy farmer address is display-only fallback and does not resolve dispatch", async (t) => {
  const notifications = installDispatchHarness(t);
  const farmer = {
    _id: "507f1f77bcf86cd799439012",
    address: { barangay: "Poblacion", municipality: "Tigbauan" },
  };

  const result = await notifyDispatchRequestSubmitted({
    request: dispatchRequest(
      "507f1f77bcf86cd799439023",
      {},
      "unresolved",
    ),
    requestType: "AI",
    animal: { earTag: "CB-015" },
    farmer,
  });

  assert.equal(notifications[0].metadata.location, "Poblacion, Tigbauan");
  assert.equal(result.unresolvedLocation, true);
  assert.equal(result.municipalityCode, null);
  assert.equal(result.municipalityName, null);
});

test("confirmed detected address is the final readable location fallback", () => {
  assert.equal(
    resolveDispatchDisplayLocation({}, {
      farmLocation: {
        isConfirmed: true,
        detectedAddress: "Brgy. Trapiche, Oton, Iloilo",
      },
    }),
    "Brgy. Trapiche, Oton, Iloilo",
  );
  assert.equal(resolveDispatchDisplayLocation({}, {}), "location not provided");
});

test("scheduled and rescheduled AI and Health copy uses date plus visit period", () => {
  const scheduledDate = "2026-08-08T04:00:00.000Z";
  const cases = [
    [
      "ai",
      "service_visit_scheduled",
      "morning",
      "AI service visit scheduled",
      "Morning",
    ],
    [
      "ai",
      "service_visit_rescheduled",
      "afternoon",
      "AI service visit rescheduled",
      "Afternoon",
    ],
    [
      "health",
      "service_visit_scheduled",
      "morning",
      "Health assistance visit scheduled",
      "Morning",
    ],
    [
      "health",
      "service_visit_rescheduled",
      "afternoon",
      "Health assistance visit rescheduled",
      "Afternoon",
    ],
  ];

  for (const [serviceType, eventType, visitPeriod, title, periodLabel] of cases) {
    const copy = presentNotificationCopy({
      eventType,
      metadata: {
        serviceType,
        animalTag: "CB-014",
        technicianName: "Tech One",
        scheduledDate,
        visitPeriod,
      },
    });
    assert.equal(copy.title, title);
    assert.match(copy.message, new RegExp(`Aug 8, 2026 · ${periodLabel}`));
    assert.doesNotMatch(copy.message, /\b12:00\b|\bnoon\b/i);
  }
});

test("missing visit period falls back to date only", () => {
  assert.equal(
    visitScheduleLabel("2026-08-08T04:00:00.000Z", undefined),
    "Aug 8, 2026",
  );
});

test("legacy submitted event uses centralized request notification copy", () => {
  const copy = presentNotificationCopy({
    eventType: "request_submitted",
    metadata: {
      serviceType: "ai",
      animalTag: "CB-014",
      location: "Buray, Oton",
    },
  });
  assert.equal(copy.title, "AI service request for CB-014");
  assert.match(copy.message, /Buray, Oton/);
});

test("AI status-update notification carries the normalized visit period", async (t) => {
  const originals = {
    findById: Insemination.findById,
    findOneAndUpdate: Insemination.findOneAndUpdate,
    notificationCreate: Notification.create,
  };
  t.after(() => {
    Insemination.findById = originals.findById;
    Insemination.findOneAndUpdate = originals.findOneAndUpdate;
    Notification.create = originals.notificationCreate;
  });

  const existing = {
    _id: "507f1f77bcf86cd799439021",
    status: "approved",
    approvedBy: "507f1f77bcf86cd799439011",
    scheduledDate: null,
    visitPeriod: null,
    deletedAt: null,
    farmerId: "507f1f77bcf86cd799439012",
    animalId: "507f1f77bcf86cd799439013",
  };
  const updated = {
    ...existing,
    farmerId: { _id: existing.farmerId, name: "Farmer One" },
    animalId: { _id: existing.animalId, earTag: "CB-014" },
  };
  let notification;
  Insemination.findById = async () => existing;
  Insemination.findOneAndUpdate = (_filter, update) => {
    Object.assign(updated, update.$set);
    return populatedQuery(updated);
  };
  Notification.create = async (payload) => {
    notification = payload;
    return { _id: "507f1f77bcf86cd799439024", ...payload };
  };

  let statusCode;
  let body;
  await updateRequestStatus(
    {
      params: { id: existing._id },
      body: {
        status: "scheduled",
        scheduledDate: "2030-08-08",
        visitPeriod: "MORNING",
      },
      user: {
        _id: existing.approvedBy,
        role: "technician",
        name: "Tech One",
      },
      app: { get: () => ({ emit() {} }) },
    },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    },
  );

  assert.equal(statusCode, 200, body?.message);
  assert.equal(notification.eventType, "service_visit_rescheduled");
  assert.equal(notification.metadata.visitPeriod, "morning");
  assert.match(notification.message, /Aug 8, 2030 · Morning/);
  assert.doesNotMatch(notification.message, /\b12:00\b|\bnoon\b/i);
});
