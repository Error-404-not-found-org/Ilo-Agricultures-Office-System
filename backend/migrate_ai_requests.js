import mongoose from 'mongoose';
import { AIRequest } from './src/models/ai-request.model.js';
import { Insemination } from './src/models/insemination.model.js';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

if (process.env.FORCE_CUSTOM_DNS === 'true') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {
    console.error("Failed to set custom DNS:", err);
  }
}

const migrate = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log('Connected to MongoDB for migration...');

    const requests = await AIRequest.find();
    console.log(`Found ${requests.length} AIRequests to migrate.`);

    for (const req of requests) {
      // Check if already migrated
      const existing = await Insemination.findOne({ 
        farmerId: req.farmerId, 
        animalId: req.animalId, 
        createdAt: req.createdAt 
      });

      if (!existing) {
        await Insemination.create({
          farmerId: req.farmerId,
          animalId: req.animalId,
          status: req.status,
          imageUrl: req.imageUrl,
          comment: req.comment,
          preferredDate: req.preferredDate,
          scheduledDate: req.scheduledDate,
          technicianNote: req.technicianNote,
          approvedBy: req.handledBy,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt,
          // We don't have sireCode/Breed yet for requests, which is fine now
        });
        console.log(`Migrated request ${req._id}`);
      } else {
        console.log(`Skipping request ${req._id} (already exists)`);
      }
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
