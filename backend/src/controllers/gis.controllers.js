import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Task } from "../models/task.model.js";

const BARANGAY_COORDS = {
  // Legacy / custom names
  Caboloan: [10.7224, 122.4578],
  Aritao: [10.729, 122.488],
  Poblacion: [10.6942, 122.4833],
  "Trapiche Viejo": [10.688, 122.467],
  "Botong Nuevo": [10.698, 122.502],

  // 37 Official Oton Barangays (High-precision coordinates from PhilAtlas)
  "Abilay Norte": [10.7442, 122.4920],
  "Abilay Sur": [10.7250, 122.4938],
  Alegre: [10.686948, 122.490561],
  "Batuan Ilaud": [10.7217, 122.4311],
  "Batuan Ilaya": [10.7398, 122.4331],
  "Bita Norte": [10.7461, 122.4721],
  "Bita Sur": [10.7327, 122.4792],
  Botong: [10.6852, 122.4378],
  Buray: [10.7006, 122.4662],
  Cabanbanan: [10.6840, 122.4303],
  "Cabolo-an Norte": [10.7531, 122.4767],
  "Cabolo-an Sur": [10.7413, 122.4832],
  Cadinglian: [10.7390, 122.4393],
  Cagbang: [10.6992, 122.5018],
  "Calam-isan": [10.7100, 122.4415],
  Galang: [10.7245, 122.4447],
  Lambuyao: [10.7108, 122.4924],
  Mambog: [10.7329, 122.4850],
  Pakiad: [10.7109, 122.5173],
  "Poblacion East": [10.6892, 122.4811],
  "Poblacion North": [10.6916, 122.4836],
  "Poblacion South": [10.6913, 122.4712],
  "Poblacion West": [10.6949, 122.4732],
  "Pulo Maestra Vita": [10.6890, 122.4285],
  Rizal: [10.7566, 122.4494],
  Salngan: [10.7154, 122.4424],
  Sambaludan: [10.7054, 122.4304],
  "San Antonio": [10.6933, 122.4839],
  "San Nicolas": [10.6929, 122.4940],
  "Santa Clara": [10.7661, 122.4440],
  "Santa Monica": [10.7405, 122.4508],
  "Santa Rita": [10.7194, 122.4571],
  "Tagbac Norte": [10.7257, 122.4686],
  "Tagbac Sur": [10.7207, 122.4765],
  Trapiche: [10.6895, 122.4534],
  Tuburan: [10.7216, 122.4875],
  "Turog-Turog": [10.7465, 122.4290],
};

const OTON_BARANGAYS_LIST = [
  "Abilay Norte", "Abilay Sur", "Alegre", "Batuan Ilaud", "Batuan Ilaya",
  "Bita Norte", "Bita Sur", "Botong", "Buray", "Cabanbanan",
  "Cabolo-an Norte", "Cabolo-an Sur", "Cadinglian", "Cagbang", "Calam-isan",
  "Galang", "Lambuyao", "Mambog", "Pakiad", "Poblacion East",
  "Poblacion North", "Poblacion South", "Poblacion West", "Pulo Maestra Vita",
  "Rizal", "Salngan", "Sambaludan", "San Antonio", "San Nicolas",
  "Santa Clara", "Santa Monica", "Santa Rita", "Tagbac Norte", "Tagbac Sur",
  "Trapiche", "Tuburan", "Turog-Turog"
];

export const getHealthHeatmapData = async (req, res) => {
  try {
    const healthRequests = await HealthRequest.find({ status: { $ne: "Cancelled" } }, "farmerId animalId symptoms severity status createdAt")
      .populate("farmerId", "name address")
      .populate("animalId", "earTag breed species")
      .lean();

    const dataPoints = healthRequests.map(r => {
      let lat = r.farmerId?.address?.coordinates?.lat;
      let lng = r.farmerId?.address?.coordinates?.lng;
      const barangay = r.farmerId?.address?.barangay || "Poblacion";

      // Fallback to predefined barangay coordinate if database coordinate is empty
      if (!lat || !lng) {
        const coords = BARANGAY_COORDS[barangay] || BARANGAY_COORDS["Poblacion"];
        // Add minor random jitter to avoid completely stacked pins!
        lat = coords[0] + (Math.random() - 0.5) * 0.006;
        lng = coords[1] + (Math.random() - 0.5) * 0.006;
      }

      return {
        id: r._id,
        coords: [lat, lng],
        barangay,
        farmer: r.farmerId?.name || "Anonymous Farmer",
        animal: `${r.animalId?.breed || "Brahman"} ${r.animalId?.species || "Cattle"}`,
        tag: r.animalId?.earTag || "No Tag",
        symptoms: r.symptoms || "General Sickness",
        severity: r.severity || (Math.random() > 0.6 ? "High" : "Medium"),
        status: r.status || "Pending",
        date: r.createdAt
      };
    });

    res.status(200).json({ success: true, data: dataPoints });
  } catch (error) {
    console.error("[getHealthHeatmapData ERROR]", error);
    res.status(500).json({ error: error.message });
  }
};

export const getGisHubData = async (req, res) => {
  try {
    // Concurrent Parallel Query execution with specific projections to minimize DB CPU & RAM overhead!
    const [healthRequests, inseminations, activeTasks, animals] = await Promise.all([
      // 1. Health Layer Query
      HealthRequest.find({ status: { $ne: "Cancelled" } }, "farmerId animalId symptoms severity status createdAt")
        .populate("farmerId", "name address")
        .populate("animalId", "earTag breed species")
        .lean(),

      // 2. Breeding Layer Query
      Insemination.find({}, "farmerId animalId sireBreed inseminationDate outcome status")
        .populate("farmerId", "name address")
        .populate("animalId", "earTag breed")
        .lean(),

      // 3. Logistics Task Query
      Task.find({ status: { $in: ["Pending", "In Progress"] } }, "farmerId taskType category priority status createdAt")
        .populate("farmerId", "name address")
        .lean(),

      // 4. Demographic Census Query
      Animal.find({}, "species farmerId")
        .populate("farmerId", "address")
        .lean()
    ]);

    // MAP 1. HEALTH DATA
    const healthData = healthRequests.map(r => {
      let lat = r.farmerId?.address?.coordinates?.lat;
      let lng = r.farmerId?.address?.coordinates?.lng;
      const barangay = r.farmerId?.address?.barangay || "Poblacion";
      if (!lat || !lng) {
        const coords = BARANGAY_COORDS[barangay] || BARANGAY_COORDS["Poblacion"];
        lat = coords[0] + (Math.random() - 0.5) * 0.005;
        lng = coords[1] + (Math.random() - 0.5) * 0.005;
      }
      return {
        id: r._id,
        coords: [lat, lng],
        barangay,
        farmer: r.farmerId?.name || "Anonymous Farmer",
        animal: `${r.animalId?.breed || "Brahman"} ${r.animalId?.species || "Cattle"}`,
        tag: r.animalId?.earTag || "No Tag",
        symptoms: r.symptoms || "General Sickness",
        severity: r.severity || (Math.random() > 0.6 ? "High" : "Medium"),
        status: r.status || "Pending",
        date: r.createdAt
      };
    });

    // MAP 2. BREEDING DATA
    const breedingData = inseminations.map(ins => {
      let lat = ins.farmerId?.address?.coordinates?.lat;
      let lng = ins.farmerId?.address?.coordinates?.lng;
      const barangay = ins.farmerId?.address?.barangay || "Poblacion";
      if (!lat || !lng) {
        const coords = BARANGAY_COORDS[barangay] || BARANGAY_COORDS["Poblacion"];
        lat = coords[0] + (Math.random() - 0.5) * 0.005;
        lng = coords[1] + (Math.random() - 0.5) * 0.005;
      }
      return {
        id: ins._id,
        farmer: ins.farmerId?.name || "Anonymous Farmer",
        tag: ins.animalId?.earTag || "No Tag",
        breed: ins.sireBreed || ins.animalId?.breed || "Brahman",
        coords: [lat, lng],
        barangay,
        date: ins.inseminationDate ? new Date(ins.inseminationDate).toISOString().split('T')[0] : "Pending",
        status: ins.outcome === "Pregnant" ? "Confirmed Pregnant" : ins.status === "done" ? "Inseminated" : "Pending"
      };
    });

    // MAP 3. LOGISTICS DISPATCH DATA
    const dispatchData = activeTasks.map(t => {
      let lat = t.farmerId?.address?.coordinates?.lat;
      let lng = t.farmerId?.address?.coordinates?.lng;
      const barangay = t.farmerId?.address?.barangay || "Poblacion";
      if (!lat || !lng) {
        const coords = BARANGAY_COORDS[barangay] || BARANGAY_COORDS["Poblacion"];
        lat = coords[0] + (Math.random() - 0.5) * 0.005;
        lng = coords[1] + (Math.random() - 0.5) * 0.005;
      }
      return {
        id: t._id,
        farmer: t.farmerId?.name || "Anonymous Farmer",
        task: `${t.taskType} Service`,
        urgency: t.category === "Emergency" || t.priority === 1 ? "High" : t.category === "Urgent" ? "High" : "Medium",
        coords: [lat, lng],
        barangay,
        time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "09:00 AM",
        status: t.status
      };
    });

    // MAP 4. DEMOGRAPHICS DATA (Census)
    const brgyMap = {};
    OTON_BARANGAYS_LIST.forEach(b => {
      brgyMap[b] = { name: b, cattle: 0, carabao: 0, swine: 0 };
    });

    animals.forEach(a => {
      const brgy = a.farmerId?.address?.barangay;
      if (brgy && brgyMap[brgy]) {
        const species = (a.species || "").toLowerCase();
        if (species.includes("cattle")) {
          brgyMap[brgy].cattle += 1;
        } else if (species.includes("carabao")) {
          brgyMap[brgy].carabao += 1;
        } else {
          brgyMap[brgy].swine += 1;
        }
      }
    });

    const demographicData = Object.values(brgyMap).map((item, idx) => {
      const coords = BARANGAY_COORDS[item.name] || BARANGAY_COORDS["Poblacion"];
      return {
        id: `brgy-${idx}`,
        barangay: item.name,
        cattle: item.cattle,
        carabao: item.carabao,
        swine: item.swine,
        coords: coords
      };
    });

    res.status(200).json({
      success: true,
      health: healthData,
      breeding: breedingData,
      dispatches: dispatchData,
      demographics: demographicData
    });
  } catch (error) {
    console.error("[getGisHubData ERROR]", error);
    res.status(500).json({ error: error.message });
  }
};
