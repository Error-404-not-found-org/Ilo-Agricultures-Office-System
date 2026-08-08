import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';

const run = async () => {
    await connectDB();
    console.log('DB:', mongoose.connection.db.databaseName, 'Host:', mongoose.connection.host);
    const indexes = await mongoose.connection.db.collection('healthrequests').indexes();
    console.log('Indexes:', indexes.map(i => i.name));
    process.exit(0);
};

run().catch(console.error);
