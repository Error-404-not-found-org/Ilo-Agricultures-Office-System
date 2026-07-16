import { AxiosInstance } from "axios";

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
  limit = 25,
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
      ...(filters.type && filters.type !== "all"
        ? { type: filters.type }
        : {}),
      ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
    },
  });
  const records = response.data?.data || [];

  const data = records.map((record: any) => {
    const source = record.source || {};
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
      title: record.title,
      description: record.summary,
      date: record.recordDate || record.enteredAt,
      type,
      animalId: record.animalId,
      details: {
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
        serviceDate: record.recordDate,
        entryDate: record.enteredAt,
        isHistoricalEntry: source.isHistoricalEntry,
        performedByName: source.performedByName,
        lateEntryReason: source.lateEntryReason,
        requestType: record.title,
        diagnosis: source.details?.diagnosis,
        treatment: source.details?.treatment,
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
