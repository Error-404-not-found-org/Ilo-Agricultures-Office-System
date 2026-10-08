import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { User } from "../models/user.model.js";
import { getManilaMonthBoundsFor } from "../services/technician-workload-summary.service.js";
import { buildAIRequestMutationOwnershipGuard } from "../policies/request.policy.js";

const idOf = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? null;
const animalFields = (animal) => ({
  animalId: animal?.animalId ?? null,
  earTag: animal?.earTag ?? null,
  brand: animal?.brand ?? null,
  species: animal?.species ?? null,
  breed: animal?.breed ?? null,
  color: animal?.color ?? null,
});
const farmerFields = (farmer) => ({
  farmerName: farmer?.name ?? null,
  barangay: farmer?.address?.barangay ?? null,
});
const serviceFields = (record) => ({
  recordId: idOf(record),
  ...animalFields(record.animalId),
  ...farmerFields(record.farmerId),
});
const sortByDate = (field) => (a, b) => new Date(a[field]) - new Date(b[field]);

export const getMonthlyAccomplishmentReport = async (req, res) => {
  try {
    const { month, year, serviceType } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ message: "Month and Year are required." });
    }

    const numericMonth = Number(month);
    const numericYear = Number(year);
    if (!/^\d{1,2}$/.test(String(month)) || !/^\d{4}$/.test(String(year)) ||
      !Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12 ||
      !Number.isInteger(numericYear) || numericYear < 1900 || numericYear > 2100) {
      return res.status(400).json({ message: "Month and Year must be valid calendar values." });
    }
    if (req.user?.role !== "technician") {
      return res.status(403).json({ message: "Only technicians can view monthly accomplishments." });
    }
    if (!["ai", "pregnancy", "calving"].includes(serviceType)) {
      return res.status(400).json({ message: "Service type must be ai, pregnancy, or calving." });
    }
    const { start: startDate, end: endDate } = getManilaMonthBoundsFor(
      numericYear,
      numericMonth,
    );

    const monthRange = { $gte: startDate, $lt: endDate };
    const technicianId = req.user._id;
    const aiOwnership = buildAIRequestMutationOwnershipGuard({ technicianId });
    const aiFormFields = (record) => ({
      recordId: idOf(record),
      serviceDate: record.inseminationDate,
      attemptNumber: record.attemptNumber ?? null,
      estrus: record.estrus ?? null,
      sireBreed: record.sireBreed ?? null,
      sireCode: record.sireCode ?? null,
    });
    const pdFormFields = (record) => ({
      recordId: idOf(record),
      diagnosisDate: record.pregnancyDiagnosis?.date ?? null,
      result: record.pregnancyDiagnosis?.result ?? null,
      linkedInseminationId: idOf(record.inseminationId),
    });
    const aiQuery = (filter) => Insemination.find({
        deletedAt: null,
        status: "done",
        ...aiOwnership,
        ...filter,
      })
        .populate("animalId", "animalId earTag brand species breed color")
        .populate("farmerId", "name address.barangay")
        .populate("technicianId", "name")
        .lean();
    const pdQuery = (filter) => Pregnancy.find({
        deletedAt: null,
        "confirmation.confirmedBy": technicianId,
        ...filter,
      })
        .populate("animalId", "animalId earTag brand species breed color")
        .populate("farmerId", "name address.barangay")
        .populate("confirmation.confirmedBy", "name")
        .populate("inseminationId", "attemptNumber")
        .lean();
    const calvingQuery = (filter) => Calving.find({
        deletedAt: null,
        technicianId,
        ...filter,
      })
        .populate("animalId", "animalId earTag brand species breed color")
        .populate("farmerId", "name address.barangay")
        .populate("technicianId", "name")
        .populate("calves.animalId", "earTag")
        .lean();

    const inseminations = serviceType === "ai" ? await aiQuery({ inseminationDate: monthRange }) : [];
    const pregnancies = serviceType === "pregnancy" ? await pdQuery({ "pregnancyDiagnosis.date": monthRange }) : [];
    const calvings = serviceType === "calving" ? await calvingQuery({ date: monthRange }) : [];

    const artificialInsemination = inseminations.map((record) => ({
      ...serviceFields(record),
      ...aiFormFields(record),
      semenDosesUsed: record.semenDosesUsed ?? null,
      technicianName: record.technicianId?.name ?? null,
      outcome: record.outcome ?? null,
    })).sort(sortByDate("serviceDate"));
    const pregnancyDiagnosis = pregnancies.map((record) => ({
      ...serviceFields(record),
      ...pdFormFields(record),
      diagnosticMethod: record.confirmation?.methodCode ?? null,
      linkedAttemptNumber: record.inseminationId?.attemptNumber ?? null,
      expectedCalvingDate: record.targetCalvingDate ?? null,
      technicianName: record.confirmation?.confirmedBy?.name ?? null,
    })).sort(sortByDate("diagnosisDate"));
    const calving = calvings.map((record) => ({
      ...serviceFields(record),
      linkedPregnancyId: idOf(record.pregnancyId),
      linkedInseminationId: idOf(record.inseminationId),
      calvingDate: record.date,
      outcome: record.outcome ?? null,
      calvingEase: record.calvingEase ?? null,
      totalDelivered: record.totalDelivered ?? null,
      livingCalfCount: record.livingCalfCount ?? null,
      stillbornCount: record.stillbornCount ?? null,
      calves: (record.calves || []).map((calf) => ({
        animalId: idOf(calf.animalId),
        earTag: calf.earTag || calf.animalId?.earTag || null,
        sex: calf.sex ?? null,
      })),
      technicianName: record.technicianId?.name ?? null,
    })).sort(sortByDate("calvingDate"));

    const contextPregnancyIds = [...new Set(calving.map((record) => record.linkedPregnancyId).filter(Boolean))];
    const historicalPregnancies = contextPregnancyIds.length
      ? await pdQuery({ _id: { $in: contextPregnancyIds } })
      : [];
    const contextPregnancyDiagnosis = historicalPregnancies
      .filter((record) => record.pregnancyDiagnosis?.date)
      .map(pdFormFields);
    const contextAIIds = [...new Set([
      ...pregnancyDiagnosis.map((record) => record.linkedInseminationId),
      ...calving.map((record) => record.linkedInseminationId),
      ...contextPregnancyDiagnosis.map((record) => record.linkedInseminationId),
    ].filter(Boolean))];
    const historicalInseminations = contextAIIds.length
      ? await aiQuery({ _id: { $in: contextAIIds } })
      : [];
    const contextArtificialInsemination = historicalInseminations
      .filter((record) => record.inseminationDate)
      .map(aiFormFields);

    const allowedAIIds = new Set(contextArtificialInsemination.map((record) => record.recordId));
    const allowedPregnancyById = new Map(contextPregnancyDiagnosis.map((record) => [record.recordId, record]));
    const records = serviceType === "ai" ? artificialInsemination
      : serviceType === "pregnancy"
        ? pregnancyDiagnosis.map((record) => ({
          ...record,
          linkedInseminationId: allowedAIIds.has(record.linkedInseminationId)
            ? record.linkedInseminationId : null,
          linkedAttemptNumber: allowedAIIds.has(record.linkedInseminationId)
            ? record.linkedAttemptNumber : null,
        }))
        : calving.map((record) => {
          const authorizedPregnancy = allowedPregnancyById.get(record.linkedPregnancyId);
          const conflict = authorizedPregnancy?.linkedInseminationId && record.linkedInseminationId &&
            authorizedPregnancy.linkedInseminationId !== record.linkedInseminationId;
          return {
            ...record,
            linkedPregnancyId: conflict ? null : authorizedPregnancy?.recordId ?? null,
            linkedInseminationId: conflict || !allowedAIIds.has(record.linkedInseminationId)
              ? null : record.linkedInseminationId,
          };
        });
    const usedAIIds = new Set(records.map((record) => record.linkedInseminationId).filter(Boolean));
    const usedPregnancyIds = new Set(records.map((record) => record.linkedPregnancyId).filter(Boolean));

    res.status(200).json({
      month: numericMonth,
      year: numericYear,
      serviceType,
      count: records.length,
      records,
      context: {
        artificialInsemination: contextArtificialInsemination.filter((record) => usedAIIds.has(record.recordId)),
        pregnancyDiagnosis: contextPregnancyDiagnosis
          .filter((record) => usedPregnancyIds.has(record.recordId))
          .map((record) => ({
            ...record,
            linkedInseminationId: usedAIIds.has(record.linkedInseminationId)
              ? record.linkedInseminationId : null,
          })),
      },
    });
  } catch (error) {
    console.error("[getMonthlyAccomplishmentReport ERROR]", error);
    res.status(500).json({ message: "Failed to generate report." });
  }
};

export const getMunicipalCensusData = async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const [allAnimals, newAnimals, allAI, allPreg, allHealth, allFarmers] = await Promise.all([
      Animal.find({ deletedAt: null }).lean(),
      Animal.countDocuments({ createdAt: { $gte: startDate, $lte: endDate }, deletedAt: null }),
      Insemination.countDocuments({ inseminationDate: { $gte: startDate, $lte: endDate }, deletedAt: null }),
      Pregnancy.countDocuments({ createdAt: { $gte: startDate, $lte: endDate }, "pregnancyDiagnosis.result": "Pregnant", deletedAt: null }),
      HealthRequest.countDocuments({ status: "resolved", updatedAt: { $gte: startDate, $lte: endDate }, deletedAt: null }),
      User.find({ role: "farmer" }).lean()
    ]);

    // 1. Summary
    const summary = {
      totalAnimals: allAnimals.length,
      newAnimals,
      totalAI: allAI,
      totalPregnancies: allPreg,
      successRate: allAI > 0 ? ((allPreg / allAI) * 100).toFixed(1) + "%" : "0%",
      resolvedHealth: allHealth
    };

    // 2. Barangay Stats
    const brgyMap = new Map();
    // Initialize map with all barangays if needed, or just those with data
    allAnimals.forEach(a => {
        const farmer = allFarmers.find(f => f._id.toString() === a.farmerId?.toString());
        const brgy = farmer?.address?.barangay || "Unknown";
        if (!brgyMap.has(brgy)) {
            brgyMap.set(brgy, { name: brgy, animals: 0, ai: 0, health: 0 });
        }
        brgyMap.get(brgy).animals++;
    });

    // We'd ideally want to link AI and Health to Barangays too
    // This requires joining Inseminations with Farmers
    const [insWithFarmer, healthWithFarmer] = await Promise.all([
        Insemination.find({ inseminationDate: { $gte: startDate, $lte: endDate }, deletedAt: null }).populate('farmerId', 'address').lean(),
        HealthRequest.find({ updatedAt: { $gte: startDate, $lte: endDate }, status: "resolved", deletedAt: null }).populate('farmerId', 'address').lean()
    ]);

    insWithFarmer.forEach(ins => {
        const brgy = ins.farmerId?.address?.barangay || "Unknown";
        if (!brgyMap.has(brgy)) brgyMap.set(brgy, { name: brgy, animals: 0, ai: 0, health: 0 });
        brgyMap.get(brgy).ai++;
    });

    healthWithFarmer.forEach(h => {
        const brgy = h.farmerId?.address?.barangay || "Unknown";
        if (!brgyMap.has(brgy)) brgyMap.set(brgy, { name: brgy, animals: 0, ai: 0, health: 0 });
        brgyMap.get(brgy).health++;
    });

    const barangayStats = Array.from(brgyMap.values()).sort((a, b) => b.animals - a.animals);

    // 3. Reproductive Status Distribution
    const statusCounts = {};
    allAnimals.forEach(a => {
        const s = a.reproductiveStatus || "Normal";
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const reproductiveStats = Object.keys(statusCounts).map(name => ({
        name,
        value: statusCounts[name]
    }));

    res.status(200).json({
      summary,
      barangayStats,
      reproductiveStats
    });

  } catch (error) {
    console.error("[getMunicipalCensusData ERROR]", error);
    res.status(500).json({ message: "Failed to aggregate municipal data." });
  }
};
