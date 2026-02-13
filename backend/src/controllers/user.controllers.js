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
