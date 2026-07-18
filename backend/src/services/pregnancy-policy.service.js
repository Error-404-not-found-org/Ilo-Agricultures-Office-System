import { Config } from "../models/config.model.js";
import {
  resolvePregnancyConfirmationPolicy,
  validatePregnancyConfirmationPolicy,
} from "../domain/pregnancy-confirmation-policy.js";

export const PREGNANCY_CONFIRMATION_POLICY_KEY = "pregnancyConfirmationPolicy";

export const loadPregnancyConfirmationPolicy = async ({ at = new Date(), session = null } = {}) => {
  let query = Config.findOne({ key: PREGNANCY_CONFIRMATION_POLICY_KEY });
  if (session && typeof query.session === "function") query = query.session(session);
  const record = await query;
  return resolvePregnancyConfirmationPolicy({ policy: record?.value, at });
};

export const validatePregnancyConfirmationPolicyForWrite = (policy) =>
  validatePregnancyConfirmationPolicy(policy);

