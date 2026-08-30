import type { UserItem } from "@/features/admin-users/types/adminUsers.types";

import type { TechnicianWorkloadSummary } from "../services/adminWorkload.service";

export type TechnicianWorkloadViewRow = TechnicianWorkloadSummary &
  Partial<UserItem>;

export function getActiveWorkloadTotal(
  rows: TechnicianWorkloadSummary[],
): number {
  return rows.reduce((total, row) => total + row.activeWorkloadTotal, 0);
}

export function mergeTechniciansWithWorkload({
  technicians,
  workload,
}: {
  technicians: UserItem[];
  workload: TechnicianWorkloadSummary[];
}): TechnicianWorkloadViewRow[] {
  const technicianById = new Map(
    technicians.map((technician) => [String(technician._id), technician]),
  );

  return workload.map((row) => ({
    ...technicianById.get(String(row.technicianId)),
    ...row,
  }));
}
