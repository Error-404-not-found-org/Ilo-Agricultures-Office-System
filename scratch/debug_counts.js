import mongoose from 'mongoose';
import { Insemination } from './backend/src/models/insemination.model.js';
import { AIRequest } from './backend/src/models/ai-request.model.js';
import { HealthRequest } from './backend/src/models/health-request.model.js';
import { ENV } from './backend/src/config/env.js';

async function debugCounts() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  console.log("Current Server Time:", now.toISOString());
  console.log("Today Start (Server Local):", today.toISOString());
  console.log("24h Ago:", twentyFourHoursAgo.toISOString());

  const insCountToday = await Insemination.countDocuments({ createdAt: { $gte: today } });
  const aiCountToday = await AIRequest.countDocuments({ createdAt: { $gte: today } });
  
  const insCount24h = await Insemination.countDocuments({ createdAt: { $gte: twentyFourHoursAgo } });
  const aiCount24h = await AIRequest.countDocuments({ createdAt: { $gte: twentyFourHoursAgo } });

  console.log("Inseminations Today:", insCountToday);
  console.log("AI Requests Today:", aiCountToday);
  console.log("Inseminations (Last 24h):", insCount24h);
  console.log("AI Requests (Last 24h):", aiCount24h);

  process.exit(0);
}

debugCounts();
