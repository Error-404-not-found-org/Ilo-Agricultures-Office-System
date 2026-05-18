import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { ENV } from "../config/env.js";
import axios from "axios";

/**
 * POST /api/moowie/ask
 * The core AI logic that context-injects animal data into the prompt
 */
export const askMoowie = async (req, res) => {
  try {
    const { message, animalId } = req.body;
    const userRole = req.auth?.sessionClaims?.publicMetadata?.role || 'farmer';
    const GEMINI_API_KEY = ENV.GEMINI_API_KEY;

    console.log(`[Moowie Debug] Received request. API Key present: ${!!GEMINI_API_KEY}`);

    if (!GEMINI_API_KEY) {
      return res.status(200).json({ 
        text: "Moo! I'm ready to talk, but my 'Digital Brain' (API Key) hasn't been plugged in yet. Please ask the administrator to configure the Gemini API Key." 
      });
    }
    
    let context = `# Persona
You are Moowie, a professional, knowledgeable, and friendly AI Agricultural and Veterinary Field Assistant for the Iloilo Agriculture's Office (Oton, Iloilo). You are currently speaking to a ${userRole}. Keep your responses concise and action-oriented. Use high-fidelity veterinary and technical terms when speaking with technicians, and clear, supportive guidance when helping farmers. Maintain a warm 'cow-like' personality (an occasional 'Moo!' is welcome, but keep your advice highly scientific and professional).

# Goal
Your main goal is to help users with questions about the Iloilo Agriculture's Office's livestock services, breeding programs (Artificial Insemination), pregnancy checks, health request diagnostics, and field data logs. If the user asks about a specific animal, refer strictly to the database context provided below.\n\n`;

    if (animalId) {
      const [animal, inseminations, healthHistory] = await Promise.all([
        Animal.findById(animalId).lean(),
        Insemination.find({ animalId }).sort({ createdAt: -1 }).limit(3).lean(),
        HealthRequest.find({ animalId }).sort({ createdAt: -1 }).limit(3).lean()
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
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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

    const animal = await Animal.findOne({ earTag: { $regex: new RegExp(earTag, "i") } }).lean();
    if (!animal) {
      return res.status(200).json({ 
        found: false, 
        message: `Moo! I couldn't find any animal in our Oton database matching ear tag ${earTag}.` 
      });
    }

    // Retrieve recent inseminations and medical logs to provide complete context
    const [inseminations, healthHistory] = await Promise.all([
      Insemination.find({ animalId: animal._id }).sort({ createdAt: -1 }).limit(1).lean(),
      HealthRequest.find({ animalId: animal._id }).sort({ createdAt: -1 }).limit(1).lean()
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
