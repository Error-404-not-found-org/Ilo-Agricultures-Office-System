import mongoose from 'mongoose';
import { Notification } from './src/models/notification.model.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log("Connected to DB");
    const notifs = await Notification.find({ type: { $in: ["ai-request", "health-request"] } }).sort({createdAt: -1}).limit(5).populate('recipientId', 'role name');
    console.log(notifs.map(n => ({
        toRole: n.recipientId.role,
        toName: n.recipientId.name,
        title: n.title,
        message: n.message,
        createdAt: n.createdAt
    })));
    process.exit(0);
});
