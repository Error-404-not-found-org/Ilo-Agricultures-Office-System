import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from './src/models/user.model.js';
import dns from "dns";

dotenv.config();

if (process.env.FORCE_CUSTOM_DNS === 'true' || true) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {}
}

const run = async () => {
    await mongoose.connect(process.env.DB_URL);
    const users = await User.countDocuments({});
    const farmers = await User.countDocuments({ role: "farmer" });
    const technicians = await User.countDocuments({ role: "technician" });
    
    console.log("Total Users:", users);
    console.log("Total Farmers:", farmers);
    console.log("Total Technicians:", technicians);
    process.exit();
};

run().catch(console.error);
