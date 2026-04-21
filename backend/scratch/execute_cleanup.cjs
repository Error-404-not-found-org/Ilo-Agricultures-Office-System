const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

// Fix for MongoDB Atlas connection issues
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {}

dotenv.config({ path: path.join(__dirname, '../.env') });

const DB_URL = process.env.DB_URL;

// TARGET IDS FROM SURVEY
const ORPHAN_ANIMAL_IDS = []; 
const INACTIVE_FARMER_IDS = ["69c29df13ff65f99136a589c","69c3228a7ba7691353bdede8","69c3229e14bd244f56abaf16","69c323247ba7691353bdedf4","69c323ef14bd244f56abaf27"];
const UNVERIFIED_USER_IDS = ["69c3229e14bd244f56abaf16","69c323ef14bd244f56abaf27","69c3248d4a42a315e8a92275"];

async function execute() {
    try {
        console.log("Connecting to Database...");
        await mongoose.connect(DB_URL);
        
        // Define schemas manually for this script
        const User = mongoose.model('User', new mongoose.Schema({ role: String }));
        const Animal = mongoose.model('Animal', new mongoose.Schema({ earTag: String }));

        console.log("Starting Deletion Process...");

        // 1. Delete Animals
        if (ORPHAN_ANIMAL_IDS.length > 0) {
            const animalResult = await Animal.deleteMany({ _id: { $in: ORPHAN_ANIMAL_IDS } });
            console.log(`- Deleted ${animalResult.deletedCount} Orphan Animals.`);
        } else {
            console.log("- No Orphan Animals to delete.");
        }

        // 2. Delete Users (Inactives + Unverified)
        const combinedUserIds = [...new Set([...INACTIVE_FARMER_IDS, ...UNVERIFIED_USER_IDS])];
        if (combinedUserIds.length > 0) {
            const userResult = await User.deleteMany({ _id: { $in: combinedUserIds } });
            console.log(`- Deleted ${userResult.deletedCount} Inactive/Unverified Users.`);
        } else {
            console.log("- No Users to delete.");
        }

        console.log("\nCLEANUP COMPLETE.\n");
        process.exit(0);
    } catch (err) {
        console.error("Deletion Failed:", err);
        process.exit(1);
    }
}

execute();
