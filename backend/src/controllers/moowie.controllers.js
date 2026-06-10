import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { User } from "../models/user.model.js";
import { Task } from "../models/task.model.js";
import { ENV } from "../config/env.js";
import axios from "axios";

/**
 * POST /api/moowie/ask
 * The core AI logic that context-injects animal data into the prompt
 */
export const askMoowie = async (req, res) => {
  try {
    const { message, animalId } = req.body;
    const userRole = req.user?.role || 'farmer';
    const userName = req.user?.name || 'Partner';
    const GEMINI_API_KEY = ENV.GEMINI_API_KEY;

    console.log(`[Moowie Debug] Received request. API Key present: ${!!GEMINI_API_KEY}`);

    if (!GEMINI_API_KEY) {
      return res.status(200).json({ 
        text: "Moo! I'm ready to talk, but my 'Digital Brain' (API Key) hasn't been plugged in yet. Please ask the administrator to configure the Gemini API Key." 
      });
    }
    
    // Fetch general database statistics to give Moowie "global awareness/brain"
    const [
      totalAnimals,
      totalFarmers,
      totalTechs,
      totalInseminations,
      totalHealthRequests,
      totalTasks,
      speciesCounts
    ] = await Promise.all([
      Animal.countDocuments({ deletedAt: null }),
      User.countDocuments({ role: "farmer" }),
      User.countDocuments({ role: "technician" }),
      Insemination.countDocuments({ deletedAt: null }),
      HealthRequest.countDocuments({ deletedAt: null }),
      Task.countDocuments({ status: { $in: ["Pending", "In Progress"] } }),
      Animal.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: "$species", count: { $sum: 1 } } }
      ])
    ]);

    const speciesSummary = speciesCounts.map(s => `${s._id || "Unknown"}: ${s.count}`).join(", ");
    
    let context = `# Persona
You are Moowie, a professional, knowledgeable, and friendly AI Agricultural and Veterinary Field Assistant for the Iloilo Agriculture's Office (Oton, Iloilo). You are currently speaking to ${userName}, who is registered as a ${userRole}. Keep your responses concise and action-oriented. Use high-fidelity veterinary and technical terms when speaking with technicians, and clear, supportive guidance when helping farmers. Maintain a warm 'cow-like' personality (an occasional 'Moo!' is welcome, but keep your advice highly scientific and professional).

# Goal
Your main goal is to help users with questions about the Iloilo Agriculture's Office's livestock services, breeding programs (Artificial Insemination), pregnancy checks, health request diagnostics, and field data logs. If the user asks about a specific animal, refer strictly to the database context provided below.

# General Database Awareness
Use these real-time database metrics to answer general queries or counts:
- Total Registered Animals: ${totalAnimals} (${speciesSummary || "None"})
- Total Registered Farmers: ${totalFarmers}
- Total Registered Technicians: ${totalTechs}
- Total Breeding/Inseminations Logged: ${totalInseminations}
- Total Veterinary Health Requests: ${totalHealthRequests}
- Total Active Tasks/Dispatches: ${totalTasks}\n\n`;

    if (animalId) {
      const [animal, inseminations, healthHistory] = await Promise.all([
        Animal.findOne({ _id: animalId, deletedAt: null }).lean(),
        Insemination.find({ animalId, deletedAt: null }).sort({ createdAt: -1 }).limit(3).lean(),
        HealthRequest.find({ animalId, deletedAt: null }).sort({ createdAt: -1 }).limit(3).lean()
      ]);

      if (animal) {
        context += `--- CURRENT ANIMAL CONTEXT ---\n`;
        context += `Tag: ${animal.earTag}\n`;
        context += `Species: ${animal.species}\n`;
        context += `Breed: ${animal.breed}\n`;
        context += `Reproductive Status: ${animal.reproductiveStatus}\n`;
        if (animal.lastInseminationDate) context += `Last AI: ${animal.lastInseminationDate}\n`;
        if (animal.expectedCalvingDate) context += `Expected Calving: ${animal.expectedCalvingDate}\n`;
        
        if (inseminations.length > 0) {
          context += `\nRecent AI History:\n`;
          inseminations.forEach(ins => {
            context += `- ${ins.createdAt.toLocaleDateString()}: Sire ${ins.sireBreed}, Status: ${ins.status}\n`;
          });
        }

        if (healthHistory.length > 0) {
          context += `\nRecent Health Issues:\n`;
          healthHistory.forEach(h => {
            context += `- ${h.createdAt.toLocaleDateString()}: ${h.requestType} - ${h.symptoms}\n`;
          });
        }
        context += `\n------------------\n`;
      }
    }

    // Call Gemini API using axios
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: `${context}\nUser Message: ${message}`
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    const data = response.data;
    
    if (data.error) {
      throw new Error(data.error.message || "Gemini API Error");
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm a bit lost in the pasture. Could you repeat that?";

    res.status(200).json({ 
      text: aiResponse,
      debugContext: process.env.NODE_ENV === 'development' ? context : undefined
    });

  } catch (error) {
    console.error("Moowie AI Error Details:", error.response?.data || error.message || error);
    res.status(500).json({ 
      message: "Moowie is feeling a bit tired.",
      error: error.response?.data?.error?.message || error.message 
    });
  }
};

export const queryAnimalForVoiceflow = async (req, res) => {
  try {
    const { earTag } = req.body;
    if (!earTag) {
      return res.status(400).json({ error: "earTag is required" });
    }

    const animal = await Animal.findOne({ earTag: { $regex: new RegExp(earTag, "i") }, deletedAt: null }).lean();
    if (!animal) {
      return res.status(200).json({ 
        found: false, 
        message: `Moo! I couldn't find any active animal in our Oton database matching ear tag ${earTag}.` 
      });
    }

    // Retrieve recent inseminations and medical logs to provide complete context
    const [inseminations, healthHistory] = await Promise.all([
      Insemination.find({ animalId: animal._id, deletedAt: null }).sort({ createdAt: -1 }).limit(1).lean(),
      HealthRequest.find({ animalId: animal._id, deletedAt: null }).sort({ createdAt: -1 }).limit(1).lean()
    ]);

    const lastInsemination = inseminations[0] ? `Sire: ${inseminations[0].sireBreed}, Status: ${inseminations[0].status}` : "None";
    const lastHealthRequest = healthHistory[0] ? `${healthHistory[0].requestType} (${healthHistory[0].symptoms})` : "None";

    res.status(200).json({
      found: true,
      earTag: animal.earTag,
      species: animal.species,
      breed: animal.breed,
      status: animal.reproductiveStatus,
      lastInsemination,
      lastHealthRequest,
      message: `Moo! I found animal tag ${animal.earTag} (${animal.breed} ${animal.species}). Its status is currently ${animal.reproductiveStatus}.`
    });
  } catch (error) {
    console.error("[queryAnimalForVoiceflow ERROR]", error);
    res.status(500).json({ error: error.message });
  }
};

export const getUserSummaryForVoiceflow = async (req, res) => {
  try {
    const { user_name, user_role } = req.body;
    const role = user_role || 'farmer';
    const name = user_name || 'Partner';

    let message = "";
    
    // Find the user document if possible
    const userDoc = await User.findOne({ name: { $regex: new RegExp(name, "i") } }).lean();
    
    if (role === 'technician' || role === 'admin') {
      // Get counts of pending/in progress tasks
      const activeTasksCount = await Task.countDocuments({ status: { $in: ["Pending", "In Progress"] } });
      const totalAnimals = await Animal.countDocuments({ deletedAt: null });
      const totalFarmers = await User.countDocuments({ role: 'farmer' });

      message = `Moo! Hello ${name}. As an authorized ${role}, you currently have ${activeTasksCount} active tasks pending in your dashboard. Our database registers a total of ${totalAnimals} livestock and ${totalFarmers} local farmers in Oton, Iloilo.`;
      
      return res.status(200).json({
        success: true,
        totalAnimals,
        activeTasks: activeTasksCount,
        message
      });
    } else {
      // User is a farmer
      let animalCount = 0;
      let pendingRequestsCount = 0;
      
      if (userDoc) {
        animalCount = await Animal.countDocuments({ farmerId: userDoc._id, deletedAt: null });
        pendingRequestsCount = await HealthRequest.countDocuments({ 
          farmerId: userDoc._id, 
          status: "Pending",
          deletedAt: null
        });
      }

      message = `Moo! Hello ${name}. You currently have ${animalCount} registered livestock animal(s) on file with the Municipal Agriculture's Office, with ${pendingRequestsCount} active veterinary dispatches pending.`;
      
      return res.status(200).json({
        success: true,
        totalAnimals: animalCount,
        activeTasks: pendingRequestsCount,
        message
      });
    }
  } catch (error) {
    console.error("[getUserSummaryForVoiceflow ERROR]", error);
    res.status(500).json({ error: error.message });
  }
};

export const getActiveTasksForVoiceflow = async (req, res) => {
  try {
    const { user_name, user_role } = req.body;
    const role = user_role || 'farmer';
    
    let message = "";

    if (role === 'technician' || role === 'admin') {
      const activeTasks = await Task.find({ status: { $in: ["Pending", "In Progress"] } })
        .populate("farmerId", "name")
        .sort({ priority: 1, createdAt: -1 })
        .limit(5)
        .lean();

      if (activeTasks.length === 0) {
        message = "Moo! You have no pending dispatches or tasks at the moment. Excellent job keeping the fields clear!";
      } else {
        message = `Moo! Here are your active tasks:\n` + activeTasks.map((t, idx) => {
          const type = t.taskType || "Dispatch";
          const priority = t.priority === 1 ? "🚨 URGENT" : "📋 Routine";
          const farmerName = t.farmerId?.name || "Farmer";
          return `${idx + 1}. [${type} - ${priority}] for ${farmerName}: "${t.notes}"`;
        }).join("\n");
      }

      return res.status(200).json({
        success: true,
        tasksCount: activeTasks.length,
        message
      });
    } else {
      // Farmer asks for tasks (breeding requests / calving)
      const userDoc = await User.findOne({ name: { $regex: new RegExp(user_name || "", "i") } }).lean();
      
      if (!userDoc) {
        return res.status(200).json({
          success: false,
          message: "Moo! I couldn't find your client record. Please register with the Agriculture Office to view tasks."
        });
      }

      const activeTasks = await Task.find({ farmerId: userDoc._id, status: { $in: ["Pending", "In Progress"] } })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();

      if (activeTasks.length === 0) {
        message = "Moo! You have no active health requests or breeding dispatches on file. Your herd is in tip-top shape!";
      } else {
        message = `Moo! Here are your active requests:\n` + activeTasks.map((t, idx) => {
          return `${idx + 1}. [${t.taskType}] Status: ${t.status} - "${t.notes}"`;
        }).join("\n");
      }

      return res.status(200).json({
        success: true,
        tasksCount: activeTasks.length,
        message
      });
    }
  } catch (error) {
    console.error("[getActiveTasksForVoiceflow ERROR]", error);
    res.status(500).json({ error: error.message });
  }
};



