import { AnimalTimelineEvent } from "../models/animal-timeline-event.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { MedicalRecord } from "../models/medical-record.model.js";

export const createTimelineEvent = (entry) => AnimalTimelineEvent.create(entry);

const event = (eventType, occurredAt, title, summary, sourceType, sourceId, metadata = {}) => ({
  eventType, occurredAt, title, summary, sourceType, sourceId, metadata,
});

const eventMatchesType = (item, type) => {
  if (!type || type === "All") return true;
  const normalized = String(type).toLowerCase();
  const eventType = String(item.eventType || "").toLowerCase();
  const sourceType = String(item.sourceType || "").toLowerCase();

  if (normalized === "breeding") return sourceType === "insemination" || eventType.includes("ai") || eventType.includes("inseminat");
  if (normalized === "pregnancy") return sourceType === "pregnancy" || eventType.includes("pregnancy");
  if (normalized === "calving") return sourceType === "calving" || eventType.includes("calving") || eventType.includes("offspring");
  if (normalized === "health") return sourceType === "healthrequest" || eventType.includes("health");
  if (normalized === "medication") return sourceType === "medicalrecord" || eventType.includes("treatment") || eventType.includes("medicine") || eventType.includes("vaccination");
  if (normalized === "photos") return Array.isArray(item.attachments) && item.attachments.length > 0;

  return eventType.includes(normalized) || sourceType.includes(normalized);
};

const eventMatchesSearch = (item, search) => {
  if (!search) return true;
  const needle = String(search).toLowerCase();
  return [item.title, item.summary, item.sourceType, item.eventType]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
};

export const getAnimalTimeline = async (animalId, filters = {}) => {
  const [stored, inseminations, pregnancies, calvings, healthRequests, medicalRecords] = await Promise.all([
    AnimalTimelineEvent.find({ animalId }).sort({ occurredAt: -1 }).lean(),
    Insemination.find({ animalId, deletedAt: null }).sort({ createdAt: -1 }).lean(),
    Pregnancy.find({ animalId, deletedAt: null }).sort({ createdAt: -1 }).lean(),
    Calving.find({ animalId, deletedAt: null }).sort({ date: -1 }).lean(),
    HealthRequest.find({ animalId, deletedAt: null }).sort({ createdAt: -1 }).lean(),
    MedicalRecord.find({ animalId }).sort({ date: -1 }).lean(),
  ]);

  const projected = [
    ...inseminations.map((item) => event("inseminated", item.inseminationDate || item.createdAt, "Insemination record", (item.status === "cancelled" || item.status === "canceled" ? "Cancelled" : item.status === "declined" || item.status === "rejected" ? "Declined" : item.outcome || item.status), "Insemination", item._id, { status: item.status })),
    ...pregnancies.map((item) => event(item.pregnancyDiagnosis?.result === "Pregnant" ? "pregnancy_confirmed" : "pregnancy_checked", item.pregnancyDiagnosis?.date || item.createdAt, "Pregnancy check", item.pregnancyDiagnosis?.result || "Pending", "Pregnancy", item._id, { targetCalvingDate: item.targetCalvingDate })),
    ...calvings.map((item) => event("calving_recorded", item.date || item.createdAt, "Calving recorded", `${item.numberOfCalves || item.calves?.length || 0} offspring recorded`, "Calving", item._id)),
    ...healthRequests.map((item) => event("health_request_created", item.createdAt, "Health request", item.symptoms, "HealthRequest", item._id, { status: item.status, urgency: item.urgency, attachments: item.photos?.length ? item.photos : item.imageUrl ? [item.imageUrl] : [] })),
    ...medicalRecords.map((item) => event("treatment_recorded", item.date || item.createdAt, item.type, item.details?.diagnosis || item.note || "Medical record", "MedicalRecord", item._id)),
  ];

  return [...stored, ...projected]
    .filter((item) => eventMatchesType(item, filters.type))
    .filter((item) => eventMatchesSearch(item, filters.search))
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
};
