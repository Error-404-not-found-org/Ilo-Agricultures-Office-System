import { AxiosInstance } from "axios";

export interface BarangayInsightItem {
  barangay: string;
  municipality?: string;
  city?: string;
  district?: string;
  farmersCount: number;
  animalsCount: number;
  activePregnancies: number;
  pendingAIRequests: number;
  pendingHealthRequests: number;
  incompleteRecordsCount: number;
  aiSuccessRate: number | null;
  healthAlertsCount: number;
  activityScore: number;
  status: "healthy" | "attention" | "critical";
}

export interface BarangayDetailsData {
  farmers: any[];
  animals: any[];
  recentAI: any[];
  recentHealth: any[];
  recentCalvings: any[];
  timeline: {
    _id: string;
    type: "insemination" | "health" | "calving";
    title: string;
    date: string;
    description: string;
    details: any;
  }[];
  technicians: any[];
}

export const getBarangaysInsightsList = async (api: AxiosInstance): Promise<BarangayInsightItem[]> => {
  const res = await api.get("/admin/barangays/insights");
  return res.data || [];
};

export const getBarangayInsightsDetails = async (api: AxiosInstance, barangayName: string): Promise<BarangayDetailsData> => {
  const res = await api.get(`/admin/barangays/insights/${encodeURIComponent(barangayName)}`);
  return res.data || {
    farmers: [],
    animals: [],
    recentAI: [],
    recentHealth: [],
    recentCalvings: [],
    timeline: [],
    technicians: []
  };
};
