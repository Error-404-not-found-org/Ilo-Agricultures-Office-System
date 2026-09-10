import {
  getFarmerPregnancyLossReports,
  getPregnancyLossReportForTechnician,
  reviewPregnancyLossReport,
  submitPregnancyLossReport,
} from "../services/pregnancy-loss-report.service.js";

const sendError = (res, error, fallbackMessage) =>
  res.status(error.status || 500).json({
    message: error.message || fallbackMessage,
    code: error.code,
    ...(error.details ? { details: error.details } : {}),
  });

export const reportPregnancyLoss = async (req, res) => {
  try {
    const result = await submitPregnancyLossReport({
      animalId: req.params.animalId,
      farmer: req.user,
      observationDate: req.body?.observationDate,
      notes: req.body?.notes,
      evidencePhotos: req.body?.evidencePhotos ?? req.body?.photos,
    });
    req.app.get("io")?.emit("dashboardUpdate", {
      type: "PREGNANCY_LOSS_REPORTED",
      animalId: req.params.animalId,
    });
    return res.status(result.alreadyReported ? 200 : 201).json({
      message: result.alreadyReported
        ? "An active pregnancy-loss report already exists."
        : "Pregnancy-loss report submitted for Technician review.",
      code: result.alreadyReported
        ? "PREGNANCY_LOSS_REPORT_ALREADY_ACTIVE"
        : "PREGNANCY_LOSS_REPORT_CREATED",
      ...result,
    });
  } catch (error) {
    console.error("[reportPregnancyLoss ERROR]", error);
    return sendError(res, error, "Failed to submit pregnancy-loss report.");
  }
};

export const listMyPregnancyLossReports = async (req, res) => {
  try {
    const reports = await getFarmerPregnancyLossReports({
      animalId: req.params.animalId,
      farmerId: req.user._id,
    });
    return res.status(200).json({ reports });
  } catch (error) {
    console.error("[listMyPregnancyLossReports ERROR]", error);
    return sendError(res, error, "Failed to load pregnancy-loss reports.");
  }
};

export const getPregnancyLossReport = async (req, res) => {
  try {
    const report = await getPregnancyLossReportForTechnician(req.params.reportId);
    if (!report) {
      return res.status(404).json({
        message: "Pregnancy loss report not found.",
        code: "PREGNANCY_LOSS_REPORT_NOT_FOUND",
      });
    }
    return res.status(200).json({ report });
  } catch (error) {
    console.error("[getPregnancyLossReport ERROR]", error);
    return sendError(res, error, "Failed to load pregnancy-loss report.");
  }
};

export const reviewPregnancyLoss = async (req, res) => {
  try {
    const result = await reviewPregnancyLossReport({
      reportId: req.params.reportId,
      technician: req.user,
      outcome: req.body?.outcome,
      reviewNotes: req.body?.reviewNotes,
    });
    req.app.get("io")?.emit("dashboardUpdate", {
      type: "PREGNANCY_LOSS_REVIEWED",
      reportId: req.params.reportId,
      outcome: req.body?.outcome,
    });
    return res.status(200).json({
      message:
        req.body?.outcome === "confirm_loss"
          ? "Pregnancy loss confirmed."
          : req.body?.outcome === "needs_visit"
            ? "Pregnancy-loss report kept open for follow-up."
            : "Pregnancy loss was not confirmed. Pregnancy monitoring continues.",
      ...result,
    });
  } catch (error) {
    console.error("[reviewPregnancyLoss ERROR]", error);
    return sendError(res, error, "Failed to review pregnancy-loss report.");
  }
};
