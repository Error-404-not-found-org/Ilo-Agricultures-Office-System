import { loadTechnicianWorkloadSummary } from "../services/technician-workload-summary.service.js";

export const getTechnicianWorkloadSummary = async (_req, res) => {
  try {
    const technicians = await loadTechnicianWorkloadSummary();
    return res.status(200).json({ technicians });
  } catch (error) {
    console.error("[getTechnicianWorkloadSummary ERROR]", error);
    return res.status(500).json({
      message: "Failed to load Technician workload summary",
    });
  }
};
