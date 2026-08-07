import type { AxiosInstance } from "axios";
import type { ActivityFeedItem } from "../types/farmerReports.types";

const getRecordText = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  if (
    !text ||
    [
      "n/a",
      "na",
      "none",
      "no specific diagnosis logged.",
      "no treatment logged.",
    ].includes(text.toLowerCase())
  ) {
    return undefined;
  }
  return text;
};

const formatHealthLabel = (value: unknown): string | undefined => {
  const text = getRecordText(value);
  if (!text) return undefined;

  return text
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const formatOfficialRecordDate = (
  value: unknown,
): string | undefined => {
  const text = getRecordText(value);
  if (!text) return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return undefined;

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
};

export const mapHealthMedicalRecordDetails = (
  source: any,
  record: any = {},
): ActivityFeedItem["details"] => {
  const linkedRequest =
    source?.healthRequestId && typeof source.healthRequestId === "object"
      ? source.healthRequestId
      : {};
  const details = source?.details || {};
  const withdrawalDays =
    details.withdrawalPeriodDays ?? source?.withdrawalPeriodDays;

  return {
    status: "completed",
    requestType: formatHealthLabel(linkedRequest.requestType || source?.type),
    symptoms: getRecordText(linkedRequest.symptoms || source?.symptoms),
    urgency: formatHealthLabel(linkedRequest.urgency || source?.urgency),
    farmerNotes: getRecordText(linkedRequest.farmerNotes),
    diagnosis: getRecordText(details.diagnosis || source?.diagnosis),
    treatment: getRecordText(details.treatment || source?.treatment),
    medicine: getRecordText(details.medicineName || source?.medicineGiven),
    dosage: getRecordText(details.dosage || source?.dosage),
    advice: getRecordText(
      linkedRequest.advice || linkedRequest.resolutionNotes || source?.note,
    ),
    followUpDate: formatOfficialRecordDate(
      source?.followUpDate ||
        linkedRequest.followUpDate ||
        linkedRequest.followUpCheckupDate,
    ),
    withdrawalPeriod:
      withdrawalDays !== null && withdrawalDays !== undefined
        ? `${withdrawalDays} ${Number(withdrawalDays) === 1 ? "day" : "days"}`
        : undefined,
    withdrawalEndDate: formatOfficialRecordDate(
      details.withdrawalEndDate || source?.withdrawalEndDate,
    ),
    technician: getRecordText(
      record?.technicianId?.name || source?.technicianId?.name,
    ),
    serviceDate: formatOfficialRecordDate(
      record?.recordDate || source?.date || record?.enteredAt,
    ),
    entryDate: formatOfficialRecordDate(
      record?.enteredAt || source?.createdAt,
    ),
    isHistoricalEntry: Boolean(source?.isHistoricalEntry),
    performedByName: getRecordText(source?.performedByName),
    lateEntryReason: getRecordText(source?.lateEntryReason),
  };
};

export const getFarmerMilestones = async (api: AxiosInstance) => {
  const response = await api.get("/user/milestones");
  return response.data;
};

export const getFarmerActivity = async (api: AxiosInstance) => {
  const response = await api.get("/user/activity");
  return response.data;
};

export const getFarmerOfficialRecords = async (
  api: AxiosInstance,
  page = 1,
  limit = 10,
  filters: {
    search?: string;
    type?: string;
    fromDate?: string;
  } = {},
) => {
  const response = await api.get("/animals/records", {
    params: {
      page,
      limit,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.type && filters.type !== "all" ? { type: filters.type } : {}),
      ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
    },
  });
  const records = response.data?.data || [];

  const data = records.map((record: any) => {
    const source = record.source || {};
    const isHealthRecord = record.category === "Health";
    const type =
      record.category === "AI"
        ? "ai"
        : record.category === "Pregnancy"
          ? "pregnancy"
          : record.category === "Calving"
            ? "calving"
            : "health";

    return {
      id: String(record.id),
      title: isHealthRecord ? "Health Assistance" : record.title,
      description: record.summary,
      date: record.recordDate || record.enteredAt,
      type,
      animalId: record.animalId,
      details:
        isHealthRecord
          ? mapHealthMedicalRecordDetails(source, record)
          : {
              ...source.details,
              sireBreed: source.sireBreed,
              sireCode: source.sireCode,
              attemptNumber: source.attemptNumber,
              estrus: source.estrus,
              status: "completed",
              outcome: source.outcome,
              technician: record.technicianId?.name,
              technicianNote: source.technicianNote || source.note,
              inseminationDate: source.inseminationDate,
              serviceDate: formatOfficialRecordDate(record.recordDate),
              entryDate: formatOfficialRecordDate(record.enteredAt),
              isHistoricalEntry: source.isHistoricalEntry,
              performedByName: source.performedByName,
              lateEntryReason: source.lateEntryReason,
              targetCalvingDate: source.targetCalvingDate,
              calvingEase: source.calvingEase,
              numberOfCalves: source.numberOfCalves,
              calves: source.calves,
            },
      recordCategory: record.category,
    };
  });

  return {
    data,
    page: response.data?.page || page,
    limit: response.data?.limit || limit,
    total: response.data?.total || 0,
    totalPages: response.data?.totalPages || 1,
  };
};
