const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

// Fix for MongoDB Atlas connection issues on some networks
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    console.log("Custom DNS set to 8.8.8.8 for reliability.");
} catch (err) {
    console.error("DNS setServers failed:", err.message);
}

dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_URL = process.env.DB_URL;

async function survey() {
    try {
        console.log("Connecting to:", DB_URL);
        await mongoose.connect(DB_URL);
        
        // Define schemas manually for this script to avoid import issues
        const User = mongoose.model('User', new mongoose.Schema({ role: String, name: String, email: String }));
        const Animal = mongoose.model('Animal', new mongoose.Schema({ farmerId: mongoose.Schema.Types.ObjectId, earTag: String, breed: String }));
        const Insemination = mongoose.model('Insemination', new mongoose.Schema({ farmerId: mongoose.Schema.Types.ObjectId }));
        const HealthRequest = mongoose.model('HealthRequest', new mongoose.Schema({ farmerId: mongoose.Schema.Types.ObjectId }));
        const AIRequest = mongoose.model('AIRequest', new mongoose.Schema({ farmerId: mongoose.Schema.Types.ObjectId }));
        const Pregnancy = mongoose.model('Pregnancy', new mongoose.Schema({ farmerId: mongoose.Schema.Types.ObjectId }));
        const Calving = mongoose.model('Calving', new mongoose.Schema({ farmerId: mongoose.Schema.Types.ObjectId }));

        console.log("Scanning...");
        
        const allAnimals = await Animal.find({});
        const orphanIds = [];
        for (const animal of allAnimals) {
            const owner = await User.findById(animal.farmerId);
            if (!owner) orphanIds.push(animal._id);
        }

        const farmers = await User.find({ role: 'farmer' });
        const inactiveIds = [];
        for (const farmer of farmers) {
            const counts = await Promise.all([
                Animal.countDocuments({ farmerId: farmer._id }),
                Insemination.countDocuments({ farmerId: farmer._id }),
                HealthRequest.countDocuments({ farmerId: farmer._id }),
                AIRequest.countDocuments({ farmerId: farmer._id }),
                Pregnancy.countDocuments({ farmerId: farmer._id }),
                Calving.countDocuments({ farmerId: farmer._id })
            ]);
            if (counts.reduce((a,b) => a+b, 0) === 0) inactiveIds.push(farmer._id);
        }

        const unverifiedUsers = await User.find({ isVerified: false });
        const unverifiedIds = unverifiedUsers.map(u => u._id);

        console.log("SURVEY_RESULTS_START");
        console.log(JSON.stringify({
            orphans: orphanIds.length,
            inactives: inactiveIds.length,
            unverified: unverifiedIds.length,
            orphanIds,
            inactiveIds,
            unverifiedIds
        }));
        console.log("SURVEY_RESULTS_END");
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

survey();
