import { AxiosInstance } from "axios";

export const getAdminStats = async (api: AxiosInstance) => {
  const res = await api.get("/admin/stats");
  return res.data;
};

export const getAdminMonitoringData = async (api: AxiosInstance) => {
  const res = await api.get("/admin/monitoring");
  return res.data;
};

export const triggerDatabaseBackup = async (api: AxiosInstance) => {
  const res = await api.get("/admin/backup");
  return res.data;
};

export interface AdminRecentActivity {
  id: string;
  type:
    | "pregnancy_confirmed"
    | "animal_registered"
    | "ai_completed"
    | "health_request_created"
    | "health_service_completed"
    | "user_invited"
    | "user_registered"
    | "calving_recorded";
  title: string;
  description: string;
  occurredAt: string;
  entityType: "Animal" | "Insemination" | "Pregnancy" | "HealthRequest" | "User" | "Calving";
  entityId: string;
  metadata?: {
    animalTag?: string;
    species?: string;
    breed?: string;
    farmerName?: string;
    technicianName?: string;
    barangay?: string;
    urgency?: string;
    calfSex?: string;
    userRole?: string;
  };
}

export const getAdminRecentActivities = async (
  api: AxiosInstance,
  limit = 6
): Promise<AdminRecentActivity[]> => {
  const res = await api.get("/admin/recent-activities", { params: { limit } });
  return Array.isArray(res.data?.data) ? res.data.data : [];
};
