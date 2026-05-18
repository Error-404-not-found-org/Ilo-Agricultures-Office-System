import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log("Connected to MongoDB.");
  const db = mongoose.connection.db;
  
  const Insemination = db.collection('inseminations');
  const Pregnancy = db.collection('pregnancies');
  
  const insCount = await Insemination.countDocuments();
  console.log("Total Inseminations:", insCount);
  
  const pregCount = await Pregnancy.countDocuments();
  console.log("Total Pregnancies:", pregCount);
  
  const latestPregs = await Pregnancy.find().sort({createdAt: -1}).limit(5).toArray();
  console.log("Latest Pregnancies:", JSON.stringify(latestPregs, null, 2));

  process.exit(0);
}).catch(console.error);
