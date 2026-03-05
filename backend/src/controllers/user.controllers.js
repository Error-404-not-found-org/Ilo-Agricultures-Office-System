import { User } from "../models/user.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";

export const createInvitedUser = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, address, imageUrl, role } =
      req.body;

    // Authorization Check
    const requesterRole = req.auth.claims.metadata?.role;
    
    // Default to farmer if not specified, but validate role
    const targetRole = role || "farmer";

    if (requesterRole === "technician" && targetRole !== "farmer") {
        return res.status(403).json({ message: "Technicians can only create Farmer accounts." });
    }

    if (requesterRole === "farmer") {
        return res.status(403).json({ message: "Farmers cannot create accounts." });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if(existingUser) {
        return res.status(400).json({ message: "User with this email already exists." });
    }

    const newUser = await User.create({
      name: `${firstName} ${lastName}`,
      phoneNumber,
      email: email || undefined,
      address,
      imageUrl: imageUrl || "",
      role: targetRole,
      isVerified: !!email,
    });

    if (email) {
      const invitation = await clerkClient.invitations.createInvitation({
        emailAddress: email,
        publicMetadata: { 
            invitedBySystem: true,
            role: targetRole 
        },
        redirectUrl: "https://ilo-agricultures-inseminati-p5bbd.sevalla.app/",
      });

      newUser.clerkId = invitation.id; // Corrected from userId to id for invitation? Let's check docs or safe bet. 
      // Actually invitation.id is the invitation ID. When user accepts, webhook handles the user creation/update.
      // But we can store it if needed. However, the webhook logic we wrote tries to match by email.
      // Let's keep it simple. We don't necessarily need clerkId on the user until they sign up.
      // But for reference we can store it.
      // WAIT: In webhook we look up by email. 
      
      await newUser.save();
    }

    res.status(201).json({ message: `${targetRole} created successfully`, newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create user" });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { role } = req.query;
    
    const query = {};
    if (role) {
      query.role = role;
    }

    const users = await User.find(query).select("-password"); 
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

export const syncUser = async (req, res) => {
  try {
    const { userId } = req.auth;
    const user = await clerkClient.users.getUser(userId);

    const emailObj = user.emailAddresses[0];
    const email = emailObj?.emailAddress;

    if (!email) {
      return res.status(400).json({ message: "User has no email" });
    }

    const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    const isVerified = emailObj?.verification?.status === "verified";

    // Upsert user
    const dbUser = await User.findOneAndUpdate(
      { email },
      {
        clerkId: userId,
        name: name || "New User",
        imageUrl: user.imageUrl || "",
        isVerified,
        $setOnInsert: { role: "technician" }, // Default safe role if new
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
     
    // Sync role from metadata if present
    if (user.publicMetadata?.role && dbUser.role !== user.publicMetadata.role) {
        dbUser.role = user.publicMetadata.role;
        await dbUser.save();
    }

    res.status(200).json({ message: "User synced", user: dbUser });
  } catch (error) {
    console.error("Error syncing user:", error);
    res.status(500).json({ message: "Failed to sync user" });
  }
};
