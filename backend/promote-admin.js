import dotenv from 'dotenv';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { connectDB } from './src/config/db.js';
import { User } from './src/models/user.model.js';

dotenv.config();

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const promoteToAdmin = async (email) => {
  if (!email) {
    console.error('Please provide an email address.');
    process.exit(1);
  }

  try {
    await connectDB();
    console.log(`Searching for user with email: ${email}...`);

    // 1. Update MongoDB
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { role: 'admin', isVerified: true },
      { new: true }
    );

    if (!user) {
      console.error('User not found in MongoDB. Make sure they have signed up first.');
      process.exit(1);
    }

    console.log(`MongoDB: Updated role of ${user.name} to 'admin'.`);

    // 2. Update Clerk
    if (user.clerkId) {
      await clerkClient.users.updateUserMetadata(user.clerkId, {
        publicMetadata: { role: 'admin' },
      });
      console.log(`Clerk: Updated publicMetadata.role for ${user.clerkId} to 'admin'.`);
    } else {
        console.warn('Clerk: User record has no clerkId. Skipping Clerk update.');
    }

    console.log('\n--- SUCCESS ---');
    console.log(`${email} is now an admin. Please restart the mobile app and sign in again.`);
    process.exit(0);
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
};

const targetEmail = process.argv[2] || process.env.ADMIN_EMAIL;
promoteToAdmin(targetEmail);


// node promote-admin.js your-email@example.com
