import { connectDB } from './src/config/db.js';
import { User } from './src/models/user.model.js';

const listUsers = async () => {
    try {
        await connectDB();
        const users = await User.find({}, 'name email role clerkId');
        console.log(JSON.stringify(users, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

listUsers();

// node list-users-temp.js
