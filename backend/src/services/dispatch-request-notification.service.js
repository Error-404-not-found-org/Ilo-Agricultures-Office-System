import {
  resolveDispatchNotificationMode,
  DISPATCH_NOTIFICATION_MODES,
} from "../domain/geographic/dispatchMode.js";
import { resolveDispatchRecipients } from "./dispatch-recipient.service.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { sendNotificationPush } from "./notification-delivery.service.js";

const cleanLocationPart = (value) =>
  typeof value === "string" ? value.trim() : "";

const joinLocationParts = (...parts) =>
  [...new Set(parts.map(cleanLocationPart).filter(Boolean))].join(", ");

/**
 * Builds human-readable notification copy without affecting dispatch resolution.
 * Recipient selection must continue to use the canonical dispatch location.
 */
export const resolveDispatchDisplayLocation = (
  dispatchLocation = {},
  farmer = {},
) => {
  const canonicalLocation = joinLocationParts(
    dispatchLocation.barangayName,
    dispatchLocation.municipalityName,
  );
  if (canonicalLocation) return canonicalLocation;

  const addressLocation = joinLocationParts(
    farmer.address?.barangay,
    farmer.address?.city || farmer.address?.municipality,
  );
  if (addressLocation) return addressLocation;

  const confirmedDetectedAddress = farmer.farmLocation?.isConfirmed
    ? cleanLocationPart(farmer.farmLocation.detectedAddress)
    : "";
  return confirmedDetectedAddress || "location not provided";
};

export const getDispatchRequestNotificationPresentation = ({
  request,
  requestType,
  animal,
  farmer,
  displayLocation,
}) => {
  const isReInsemination =
    requestType === "AI" && Boolean(request?.previousAttemptId);
  const animalTag = animal?.earTag || animal?.animalId || "the animal";
  const farmerName = cleanLocationPart(farmer?.name) || "A farmer";

  if (isReInsemination) {
    return {
      eventType: "re_insemination_requested",
      title: `Re-insemination request in ${displayLocation}`,
      message: `${farmerName} requested another AI service for ${animalTag} after the previous attempt was confirmed unsuccessful.`,
      requestKind: "re_insemination",
    };
  }

  return {
    eventType: "request_submitted",
    title:
      requestType === "AI"
        ? `New AI request in ${displayLocation}`
        : `New health request in ${displayLocation}`,
    message:
      requestType === "AI"
        ? `An artificial insemination request is available in ${displayLocation}.`
        : `A ${request?.urgency || "normal"} health request is available in ${displayLocation}.`,
    requestKind: requestType === "AI" ? "initial_ai" : "health",
  };
};

/**
 * Orchestrates dispatch notifications, ensuring safe isolation from request creation.
 */
export async function notifyDispatchRequestSubmitted({
  request,
  requestType,
  animal,
  farmer,
}) {
  if (!request || !requestType || !animal || !farmer) {
    throw new Error("Missing required notification inputs.");
  }

  const mode = resolveDispatchNotificationMode();
  const dispatchLocation = request.dispatch?.location || {};
  const dispatchStage = request.dispatch?.stage || "local";
  const displayLocation = resolveDispatchDisplayLocation(
    dispatchLocation,
    farmer,
  );
  
  const isUnresolved = !dispatchLocation.municipalityCode || request.dispatch?.resolutionStatus === "unresolved";
  const unresolvedLocation = isUnresolved;

  const {
    selectedRecipients,
    eligibleLocalRecipients,
    legacyRecipients,
    diagnostics,
  } = await resolveDispatchRecipients({
    requestType,
    dispatchLocation,
    dispatchStage,
    notificationMode: mode,
  });

  const isTargeted = mode === DISPATCH_NOTIFICATION_MODES.TARGETED;
  const noLocalRecipient = eligibleLocalRecipients.length === 0;

  let recipientsToNotify = selectedRecipients;

  // 15. UNRESOLVED LOCATION 
  // 16. NO ELIGIBLE LOCAL TECHNICIAN
  if (isTargeted && (unresolvedLocation || noLocalRecipient)) {
    recipientsToNotify = [];
  }

  const deliveredRecipientIds = [];
  const failedRecipientIds = [];

  // Technician-facing metadata payload
  const technicianMetadata = {
    requestId: request._id,
    serviceType: requestType,
    requestType: requestType,
    urgency: request.urgency || "normal",
    animalTag: animal.earTag || animal.animalId || "an animal",
    municipalityCode: dispatchLocation.municipalityCode,
    municipalityName: dispatchLocation.municipalityName,
    barangayCode: dispatchLocation.barangayCode,
    barangayName: dispatchLocation.barangayName,
    location: displayLocation,
    dispatchStage,
    attemptNumber: request.attemptNumber || null,
    previousAttemptId: request.previousAttemptId || null,
  };

  const locString = displayLocation;
  const notificationPresentation = getDispatchRequestNotificationPresentation({
    request,
    requestType,
    animal,
    farmer,
    displayLocation: locString,
  });
  const notificationTitle = notificationPresentation.title;
  const notificationMessage = notificationPresentation.message;
  technicianMetadata.requestKind = notificationPresentation.requestKind;

  // Deliver to technicians with failure isolation
  const results = await Promise.allSettled(
    recipientsToNotify.map(async (technician) => {
      const recipientId = technician._id;
      const dedupeKey = `dispatch:submitted:v1:${requestType}:${request._id}:${recipientId}`;

      const result = await Notification.findOneAndUpdate(
        { dedupeKey },
        {
          $setOnInsert: {
            recipientId,
            senderId: farmer._id,
            type: requestType === "AI" ? "ai-request" : "health-request",
            category: "dispatch",
            eventType: notificationPresentation.eventType,
            relatedId: request._id,
            linkType: "request",
            dedupeKey,
            title: notificationTitle,
            message: notificationMessage,
            metadata: technicianMetadata,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          includeResultMetadata: true,
        },
      );
      
      // Mongoose v6/v7 differences handling
      const notification = result?.value || result;
      const wasInserted = result?.lastErrorObject
        ? !result.lastErrorObject.updatedExisting
        : Boolean(notification);

      if (wasInserted && technician.pushToken) {
        await sendNotificationPush({
          recipient: technician,
          title: notificationTitle,
          message: notificationMessage,
          eventType: notificationPresentation.eventType,
          type: requestType === "AI" ? "ai" : "health",
          relatedId: request._id,
          linkType: "request",
          metadata: {
            requestId: String(request._id),
            requestKind: notificationPresentation.requestKind,
          },
        });
      }

      deliveredRecipientIds.push(recipientId);
    })
  );

  // Mark failed recipients
  results.forEach((r, idx) => {
    if (r.status === "rejected") {
      const recipientId = recipientsToNotify[idx]._id;
      const i = deliveredRecipientIds.indexOf(recipientId);
      if (i > -1) deliveredRecipientIds.splice(i, 1);
      failedRecipientIds.push(recipientId);
    }
  });

  // Admin Notification
  const admins = await User.find({ role: "admin", status: { $ne: "suspended" }, deletedAt: null }).lean();
  const adminDeliveredRecipientIds = [];
  const adminFailedRecipientIds = [];

  let dispatchOutcome = "legacy_broadcast";
  if (isTargeted) {
    if (unresolvedLocation) {
      dispatchOutcome = "location_unresolved";
    } else if (noLocalRecipient) {
      dispatchOutcome = "no_local_recipient";
    } else {
      dispatchOutcome = "local_recipients_found";
    }
  } else if (mode === DISPATCH_NOTIFICATION_MODES.OBSERVE) {
    dispatchOutcome = "observe_broadcast";
  }

  const adminMetadata = {
    requestId: request._id,
    serviceType: requestType,
    requestType: requestType,
    urgency: request.urgency || "normal",
    municipalityCode: dispatchLocation.municipalityCode,
    municipalityName: dispatchLocation.municipalityName,
    dispatchOutcome,
    eligibleLocalRecipientCount: eligibleLocalRecipients.length,
    selectedRecipientCount: recipientsToNotify.length,
  };

  const adminResults = await Promise.allSettled(
    admins.map(async (admin) => {
      const adminId = admin._id;
      const dedupeKey = `dispatch:submitted:admin:v1:${requestType}:${request._id}:${adminId}`;

      await Notification.findOneAndUpdate(
        { dedupeKey },
        {
          $setOnInsert: {
            recipientId: adminId,
            senderId: farmer._id,
            type: "system",
            category: "admin_summary",
            eventType: "dispatch_summary",
            relatedId: request._id,
            linkType: "request",
            dedupeKey,
            title: `Dispatch Summary: ${requestType} in ${locString}`,
            message: `Dispatch mode ${mode} evaluated ${eligibleLocalRecipients.length} local eligible technicians for the request.`,
            metadata: adminMetadata,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          includeResultMetadata: true,
        },
      );
      
      adminDeliveredRecipientIds.push(adminId);
    })
  );

  adminResults.forEach((r, idx) => {
    if (r.status === "rejected") {
      const adminId = admins[idx]._id;
      const i = adminDeliveredRecipientIds.indexOf(adminId);
      if (i > -1) adminDeliveredRecipientIds.splice(i, 1);
      adminFailedRecipientIds.push(adminId);
    }
  });

  return {
    mode,
    requestId: request._id,
    requestType,
    municipalityCode: dispatchLocation.municipalityCode || null,
    municipalityName: dispatchLocation.municipalityName || null,
    legacyRecipientCount: legacyRecipients.length,
    eligibleLocalRecipientCount: eligibleLocalRecipients.length,
    selectedRecipientCount: recipientsToNotify.length,
    deliveredRecipientIds,
    failedRecipientIds,
    adminDeliveredRecipientIds,
    adminFailedRecipientIds,
    noLocalRecipient,
    unresolvedLocation,
    rejectionReasonCounts: diagnostics.rejectionReasonCounts,
  };
}
