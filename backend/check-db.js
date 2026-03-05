import { connectDB } from './src/config/db.js';
import { User } from './src/models/user.model.js';
import { Animal } from './src/models/animal.model.js';
import { Insemination } from './src/models/insemination.model.js';
import { Pregnancy } from './src/models/pregnancy.model.js';

const checkCounts = async () => {
    try {
        await connectDB();
        
        console.log("--- Database Counts ---");
        const users = await User.find();
        console.log("Users:", users);
        console.log("User Count:", await User.countDocuments());
        console.log("Animals:", await Animal.countDocuments());
        console.log("Inseminations:", await Insemination.countDocuments());
        console.log("Pregnancies:", await Pregnancy.countDocuments());
        console.log("-----------------------");
        
        process.exit(0);
    } catch (error) {
        console.error("Error checking counts:", error);
        process.exit(1);
    }
};

checkCounts();
