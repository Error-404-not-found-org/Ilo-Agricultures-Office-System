import {
  formatAnimalReference,
  getFullAnimalReference,
} from "../../farmer-dashboard/utils/farmerDashboard.transforms";

export const ANIMAL_RECORD_CATEGORY_OPTIONS = [
  { label: "All", value: "All" },
  { label: "Reproduction", value: "Reproduction" },
  { label: "Health", value: "Health" },
  { label: "Calving", value: "Calving" },
] as const;

export type RecordBadgeDomain =
  | "request"
  | "service"
  | "outcome"
  | "observation"
  | "pregnancy"
  | "task"
  | "animal"
  | "calving"
  | "health";

export type RecordBadgePresentation = {
  label: string;
  domain: RecordBadgeDomain;
  variant: "success" | "warning" | "danger" | "info" | "neutral";
};

export type AnimalRecordPresentation = {
  title: string;
  pageTitle: string;
  category: "Reproduction" | "Health" | "Calving";
  date?: string;
  animalReference: string;
  fullAnimalReference: string;
  badges: RecordBadgePresentation[];
  details: string[];
};

const words = (value: unknown) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();

const personName = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "name" in value) {
    return String((value as { name?: unknown }).name || "");
  }
  return "";
};

const attemptNumber = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "object" && "attemptNumber" in value) {
    return String((value as { attemptNumber?: unknown }).attemptNumber || "");
  }
  return "";
};

const pregnancyStage = (stage: unknown) => {
  if (stage === "early") return "Early confirmation";
  if (stage === "standard") return "Standard confirmation";
  return "Legacy Day-60 confirmation";
};

const pregnancyRecheck = (status: unknown): RecordBadgePresentation | null => {
  if (status === "pending") {
    return { label: "Continuation recheck due", domain: "pregnancy", variant: "warning" };
  }
  if (status === "continuing") {
    return { label: "Pregnancy continuing", domain: "pregnancy", variant: "success" };
  }
  if (status === "loss_detected") {
    return { label: "Pregnancy loss recorded", domain: "pregnancy", variant: "danger" };
  }
  if (status === "follow_up_required") {
    return { label: "Diagnostic follow-up required", domain: "task", variant: "warning" };
  }
  return null;
};

const calvingOutcome = (record: any) => {
  const living = Number(record.livingCalfCount ?? record.calves?.length ?? 0);
  const stillborn = Number(record.stillbornCount ?? record.nonLivingCalves?.length ?? 0);
  const outcome = String(record.outcome || "").toLowerCase();

  if (outcome === "mixed" || (living > 0 && stillborn > 0)) {
    return {
      title: "Mixed delivery",
      summary: `${living} living, ${stillborn} stillborn`,
      badge: "Mixed delivery",
    };
  }
  if (outcome === "stillbirth" || stillborn > 0) {
    return {
      title: "Calving outcome recorded",
      summary: "Stillbirth",
      badge: "Pregnancy loss recorded",
    };
  }
  if (outcome === "abortion") {
    return {
      title: "Calving outcome recorded",
      summary: "Pregnancy loss",
      badge: "Pregnancy loss recorded",
    };
  }
  return {
    title: "Calving recorded",
    summary: `${living} living calf${living === 1 ? "" : "ves"}`,
    badge: "Calving recorded",
  };
};

export const formatAnimalRecord = (
  record: any,
  animal?: any,
): AnimalRecordPresentation => {
  const identity = record.animalId || animal;
  const animalReference = formatAnimalReference(identity);
  const fullAnimalReference = getFullAnimalReference(identity);
  const kind = String(record.recordKind || record.type || "").toLowerCase();
  const date = record.recordDate || record.date || record.createdAt;

  if (kind === "insemination" || kind === "ai") {
    const number = Number(record.attemptNumber || 1);
    const failed = record.isSuccess === false || /failed|unsuccessful|re-heat/i.test(record.outcome || "");
    const confirmed = record.isSuccess === true || /pregnant|successful/i.test(record.outcome || "");
    const previous = record.previousAttemptReference || attemptNumber(record.previousAttemptId);
    const next = record.nextAttemptReference || attemptNumber(record.nextAttemptId);
    const technician = personName(record.technicianId || record.approvedBy);
    const badges: RecordBadgePresentation[] = [
      { label: "AI service completed", domain: "service", variant: "success" },
      failed
        ? { label: "Attempt unsuccessful", domain: "outcome", variant: "danger" }
        : confirmed
          ? { label: "Pregnancy confirmed", domain: "outcome", variant: "success" }
          : { label: "Outcome awaiting confirmation", domain: "outcome", variant: "warning" },
    ];
    return {
      title: `AI attempt ${number} · ${animalReference}`,
      pageTitle: `AI Attempt ${number}`,
      category: "Reproduction",
      date,
      animalReference,
      fullAnimalReference,
      badges,
      details: [
        failed ? `Outcome: Unsuccessful` : confirmed ? "Outcome: Successful" : "Breeding outcome has not been confirmed",
        failed && record.failureReason ? words(record.failureReason) : "",
        previous ? `Previous attempt: ${previous}` : "",
        next ? `Followed by attempt ${next}` : "",
        technician ? `Technician: ${technician}` : "",
      ].filter(Boolean),
    };
  }

  if (kind === "pregnancy") {
    const result = record.pregnancyDiagnosis?.result || record.result;
    const pregnant = String(result).toLowerCase() === "pregnant";
    const method = record.confirmation?.methodCode;
    const technician = personName(record.confirmation?.confirmedBy || record.technicianId);
    const relatedAttempt = record.inseminationId?.attemptNumber;
    const recheck = pregnancyRecheck(record.recheckStatus);
    return {
      title: `Pregnancy diagnosis · ${animalReference}`,
      pageTitle: "Pregnancy Diagnosis",
      category: "Reproduction",
      date: record.pregnancyDiagnosis?.date || date,
      animalReference,
      fullAnimalReference,
      badges: [
        pregnant
          ? { label: "Pregnancy confirmed", domain: "pregnancy", variant: "success" }
          : { label: "Not pregnant", domain: "pregnancy", variant: "neutral" },
        ...(recheck ? [recheck] : []),
      ],
      details: [
        method ? `Method: ${words(method)}` : "Method not recorded",
        `Stage: ${pregnancyStage(record.confirmation?.stage)}`,
        relatedAttempt ? `Related AI attempt: ${relatedAttempt}` : "",
        technician ? `Technician: ${technician}` : "",
      ].filter(Boolean),
    };
  }

  if (kind === "farmer_observation" || kind === "observation") {
    return {
      title: `Farmer observation · ${animalReference}`,
      pageTitle: "Farmer Observation",
      category: "Reproduction",
      date,
      animalReference,
      fullAnimalReference,
      badges: [{
        label: "Observation awaiting technician review",
        domain: "observation",
        variant: "warning",
      }],
      details: [record.notes || record.summary || "Farmer-submitted observation"],
    };
  }

  if (kind === "calving") {
    const outcome = calvingOutcome(record);
    const offspring = (record.calves || [])
      .map((calf: any) => formatAnimalReference(calf))
      .filter((value: string) => value !== "Animal");
    return {
      title: `${outcome.title} · ${animalReference}`,
      pageTitle: "Calving Record",
      category: "Calving",
      date,
      animalReference,
      fullAnimalReference,
      badges: [{
        label: outcome.badge,
        domain: "calving",
        variant: outcome.badge === "Calving recorded" ? "success" : "danger",
      }],
      details: [
        outcome.summary,
        offspring.length ? `Offspring: ${offspring.join(", ")}` : "",
        record.technicianNote || record.notes || "",
      ].filter(Boolean),
    };
  }

  const request = kind === "health_request";
  const technician = personName(record.handledBy || record.technicianId);
  const serviceComplete = ["resolved", "completed", "done"].includes(
    String(record.status || "").toLowerCase(),
  );
  return {
    title: `${record.type || record.requestType || "Health assistance record"} · ${animalReference}`,
    pageTitle: "Health Assistance Record",
    category: "Health",
    date,
    animalReference,
    fullAnimalReference,
    badges: [{
      label: request
        ? serviceComplete
          ? "Health service completed"
          : "Request awaiting review"
        : "Health record",
      domain: request ? "request" : "health",
      variant: serviceComplete ? "success" : request ? "warning" : "neutral",
    }],
    details: [
      record.details?.diagnosis || record.diagnosis ? `Diagnosis: ${record.details?.diagnosis || record.diagnosis}` : "",
      record.details?.treatment || record.treatment ? `Treatment: ${record.details?.treatment || record.treatment}` : "",
      record.followUpDate ? `Follow-up: ${new Date(record.followUpDate).toLocaleDateString()}` : "",
      technician ? `Technician: ${technician}` : "",
    ].filter(Boolean),
  };
};
