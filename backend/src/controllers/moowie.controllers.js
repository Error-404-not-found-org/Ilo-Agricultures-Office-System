import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { ENV } from "../config/env.js";

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
    
    let context = `You are "Moowie", a professional and friendly AI agricultural assistant for the Iloilo Agriculture's Office. 
    You are speaking to a ${userRole}. 
    Be concise, helpful, and use technical terminology only when speaking to technicians.
    Maintain a helpful 'cow' persona (occasional 'Moo!' is okay but keep it professional).
    If the user asks about a specific animal, reference the data provided.\n\n`;

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

    // Call Gemini API using native fetch
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${context}\nUser Message: ${message}`
          }]
        }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || "Gemini API Error");
    }

    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm a bit lost in the pasture. Could you repeat that?";

    res.status(200).json({ 
      text: aiResponse,
      debugContext: process.env.NODE_ENV === 'development' ? context : undefined
    });

  } catch (error) {
    console.error("Moowie AI Error Details:", error.message || error);
    res.status(500).json({ 
      message: "Moowie is feeling a bit tired.",
      error: error.message 
    });
  }
};
