import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { User } from "../models/user.model.js";

export const getMonthlyAccomplishmentReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ message: "Month and Year are required." });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Fetch all related records for this month
    const [inseminations, pregnancies, calvings] = await Promise.all([
      Insemination.find({
        $or: [
          { inseminationDate: { $gte: startDate, $lte: endDate } },
          { createdAt: { $gte: startDate, $lte: endDate }, status: 'done' }
        ]
      }).populate('animalId').populate('farmerId').lean(),
      
      Pregnancy.find({
        "pregnancyDiagnosis.date": { $gte: startDate, $lte: endDate }
      }).populate('animalId').populate('farmerId').lean(),
      
      Calving.find({
        date: { $gte: startDate, $lte: endDate }
      }).populate('animalId').populate('farmerId').lean(),
    ]);

    // MAP for grouping by Animal ID to merge events if they happen in the same month
    const mergedData = new Map();

    const getOrCreateEntry = (animal, farmer, date) => {
      const key = animal?._id?.toString() || Math.random().toString();
      if (!mergedData.has(key)) {
        mergedData.set(key, {
          date: date,
          animal: animal,
          farmer: farmer,
          ai: null,
          pd: null,
          cd: null,
          type: []
        });
      }
      return mergedData.get(key);
    };

    // Process Inseminations
    inseminations.forEach(ins => {
      const entry = getOrCreateEntry(ins.animalId, ins.farmerId, ins.inseminationDate || ins.createdAt);
      entry.type.push('AI');
      entry.ai = {
        attempt: ins.attemptNumber,
        estrus: ins.estrus === 'Natural' ? 'NH' : 'SH',
        sireBreed: ins.sireBreed,
        sireCode: ins.sireCode
      };
    });

    // Process Pregnancies
    pregnancies.forEach(preg => {
      const entry = getOrCreateEntry(preg.animalId, preg.farmerId, preg.pregnancyDiagnosis?.date || preg.createdAt);
      entry.type.push('PD');
      entry.pd = {
        date: preg.pregnancyDiagnosis?.date,
        result: preg.pregnancyDiagnosis?.result === 'Pregnant' ? 'Pregnant' : 'Empty'
      };
    });

    // Process Calvings
    calvings.forEach(calv => {
      const entry = getOrCreateEntry(calv.animalId, calv.farmerId, calv.date);
      entry.type.push('CD');
      entry.cd = {
        count: calv.numberOfCalves,
        calves: calv.calves,
        ease: calv.calvingEase
      };
    });

    // Convert Map to Array and format the type string
    const reportData = Array.from(mergedData.values()).map(entry => ({
      ...entry,
      type: [...new Set(entry.type)].join('+') // e.g., "AI+PD"
    }));

    // Sort by date
    reportData.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json(reportData);
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
      Animal.find().lean(),
      Animal.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      Insemination.countDocuments({ inseminationDate: { $gte: startDate, $lte: endDate } }),
      Pregnancy.countDocuments({ createdAt: { $gte: startDate, $lte: endDate }, "pregnancyDiagnosis.result": "Pregnant" }),
      HealthRequest.countDocuments({ status: "resolved", updatedAt: { $gte: startDate, $lte: endDate } }),
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
        Insemination.find({ inseminationDate: { $gte: startDate, $lte: endDate } }).populate('farmerId', 'address').lean(),
        HealthRequest.find({ updatedAt: { $gte: startDate, $lte: endDate }, status: "resolved" }).populate('farmerId', 'address').lean()
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
