import { User } from "../models/user.model.js";
import { evaluateTechnicianDispatchEligibility } from "../domain/geographic/eligibilityEvaluator.js";
import { DISPATCH_NOTIFICATION_MODES } from "../domain/geographic/dispatchMode.js";

/**
 * Resolves dispatch recipients for a request based on the notification mode.
 * Evaluates geographic and capability eligibility.
 */
export async function resolveDispatchRecipients({
  requestType,
  dispatchLocation,
  dispatchStage = "local",
  notificationMode,
}) {
  const allTechnicians = await User.find({ role: "technician" }).lean();

  const legacyRecipients = [];
  const eligibleLocalRecipients = [];
  const rejectedCandidates = [];
  const rejectionReasonCounts = {};

  for (const technician of allTechnicians) {
    // 1. Evaluate legacy eligibility (replicates broad delivery)
    if (technician.status !== "suspended" && technician.deletedAt == null) {
      legacyRecipients.push(technician);
    }

    // 2. Evaluate targeted local eligibility
    const eligibility = evaluateTechnicianDispatchEligibility({
      technician,
      requestType,
      dispatchLocation,
      dispatchStage,
    });

    if (eligibility.eligible) {
      eligibleLocalRecipients.push(technician);
    } else {
      rejectedCandidates.push({
        userId: technician._id,
        role: technician.role,
        blockingReasons: eligibility.blockingReasons,
      });

      for (const reason of eligibility.blockingReasons) {
        rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] || 0) + 1;
      }
    }
  }

  // Deduplicate by User _id
  const dedupe = (users) =>
    Array.from(new Map(users.map((u) => [String(u._id), u])).values());

  const dedupedLegacy = dedupe(legacyRecipients);
  const dedupedEligible = dedupe(eligibleLocalRecipients);

  let selectedRecipients = [];
  if (notificationMode === DISPATCH_NOTIFICATION_MODES.TARGETED) {
    selectedRecipients = dedupedEligible;
  } else {
    // Both 'legacy' and 'observe' default to the broad legacy cohort
    selectedRecipients = dedupedLegacy;
  }

  return {
    mode: notificationMode,
    legacyRecipients: dedupedLegacy,
    eligibleLocalRecipients: dedupedEligible,
    selectedRecipients,
    rejectedCandidates,
    diagnostics: {
      requestType,
      municipalityCode: dispatchLocation?.municipalityCode || null,
      dispatchStage,
      legacyRecipientCount: dedupedLegacy.length,
      eligibleLocalRecipientCount: dedupedEligible.length,
      selectedRecipientCount: selectedRecipients.length,
      rejectionReasonCounts,
    },
  };
}
