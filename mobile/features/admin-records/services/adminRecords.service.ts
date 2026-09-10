import type { AxiosInstance } from "axios";

export type AdminRecordKind = "insemination" | "pregnancy" | "calving";

export interface AdminRecordsFilters {
  page?: number;
  limit?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface AdminRecordsPage<T = any> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary?: {
    pregnant?: number;
    successRate?: number;
  };
}

const EXPORT_PAGE_SIZE = 100;

const RECORD_ENDPOINTS = {
  insemination: {
    path: "/admin/inseminations",
    legacyKey: "inseminations",
  },
  pregnancy: {
    path: "/admin/pregnancy-checks",
    legacyKey: "pregnancyChecks",
  },
  calving: {
    path: "/admin/calvings",
    legacyKey: "calvings",
  },
} as const;

const compactParams = (
  kind: AdminRecordKind,
  filters: AdminRecordsFilters,
) => ({
  page: filters.page ?? 1,
  limit: filters.limit ?? 10,
  ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
  ...(filters.startDate ? { startDate: filters.startDate } : {}),
  ...(filters.endDate ? { endDate: filters.endDate } : {}),
  ...(kind === "insemination" ? { status: "done" } : {}),
});

const normalizePage = <T>(
  payload: any,
  legacyKey: string,
  requested: AdminRecordsFilters,
): AdminRecordsPage<T> => {
  const pagination = payload?.pagination || payload || {};
  const data = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.[legacyKey])
      ? payload[legacyKey]
      : [];
  const page = Number(pagination.page ?? requested.page ?? 1);
  const limit = Number(pagination.limit ?? requested.limit ?? 10);
  const total = Number(pagination.total ?? data.length);
  const totalPages = Math.max(
    1,
    Number(pagination.totalPages ?? Math.ceil(total / Math.max(limit, 1))),
  );

  return {
    data,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
    total: Number.isFinite(total) && total >= 0 ? total : data.length,
    totalPages: Number.isFinite(totalPages) ? totalPages : 1,
    ...(payload?.summary ? { summary: payload.summary } : {}),
  };
};

export const getAdminRecordsPage = async <T = any>(
  api: AxiosInstance,
  kind: AdminRecordKind,
  filters: AdminRecordsFilters = {},
): Promise<AdminRecordsPage<T>> => {
  const endpoint = RECORD_ENDPOINTS[kind];
  const res = await api.get(endpoint.path, {
    params: compactParams(kind, filters),
  });
  return normalizePage<T>(res.data, endpoint.legacyKey, filters);
};

export const getAdminInseminations = (
  api: AxiosInstance,
  filters: AdminRecordsFilters = {},
) => getAdminRecordsPage(api, "insemination", filters);

export const getAdminPregnancies = (
  api: AxiosInstance,
  filters: AdminRecordsFilters = {},
) => getAdminRecordsPage(api, "pregnancy", filters);

export const getAdminCalvings = (
  api: AxiosInstance,
  filters: AdminRecordsFilters = {},
) => getAdminRecordsPage(api, "calving", filters);

export const getAllFilteredAdminRecords = async <T = any>(
  api: AxiosInstance,
  kind: AdminRecordKind,
  filters: Omit<AdminRecordsFilters, "page" | "limit">,
): Promise<T[]> => {
  const firstPage = await getAdminRecordsPage<T>(api, kind, {
    ...filters,
    page: 1,
    limit: EXPORT_PAGE_SIZE,
  });
  const records = [...firstPage.data];

  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const nextPage = await getAdminRecordsPage<T>(api, kind, {
      ...filters,
      page,
      limit: firstPage.limit,
    });
    records.push(...nextPage.data);
  }

  const uniqueRecords = new Map<string, T>();
  records.forEach((record: any, index) => {
    uniqueRecords.set(String(record?._id || "missing-id-" + index), record);
  });
  const completeRecords = Array.from(uniqueRecords.values());

  if (completeRecords.length !== firstPage.total) {
    throw new Error(
      "The complete filtered record set could not be retrieved for export.",
    );
  }

  return completeRecords;
};

export const runCompleteAdminRecordsExport = async <T = any>(
  api: AxiosInstance,
  kind: AdminRecordKind,
  filters: Omit<AdminRecordsFilters, "page" | "limit">,
  writeExport: (records: T[]) => Promise<void>,
) => {
  const completeRecords = await getAllFilteredAdminRecords<T>(
    api,
    kind,
    filters,
  );
  await writeExport(completeRecords);
};
