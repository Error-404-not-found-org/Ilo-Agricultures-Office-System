import type { AxiosInstance } from "axios";

export type TechnicianWorkloadCounts = {
  ai: number;
  health: number;
  pregnancy: number;
  calving: number;
  tasks: number;
};

export type TechnicianWorkloadSummary = {
  technicianId: string;
  name: string;
  activeWorkloadTotal: number;
  counts: TechnicianWorkloadCounts;
};

type TechnicianWorkloadSummaryResponse = {
  technicians?: TechnicianWorkloadSummary[];
};

export async function getAdminTechnicianWorkloadSummary(
  api: AxiosInstance,
): Promise<TechnicianWorkloadSummary[]> {
  const { data } = await api.get<TechnicianWorkloadSummaryResponse>(
    "/admin/technician-workload-summary",
  );

  return Array.isArray(data?.technicians) ? data.technicians : [];
}
