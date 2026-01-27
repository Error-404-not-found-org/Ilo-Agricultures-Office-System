import { User } from "../models/user.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";

export const createFarmerAccount = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, address, imageUrl } =
      req.body;

    const newUser = await User.create({
      name: `${firstName} ${lastName}`,
      phoneNumber,
      email: email || undefined,
      address,
      imageUrl: imageUrl || "",
      role: "farmer",
      isVerified: !!email,
    });

    if (email) {
      const invitation = await clerkClient.invitations.createInvitation({
        emailAddress: email,
        publicMetadata: { invitedBySystem: true },
        redirectUrl: "https://ilo-agricultures-inseminati-p5bbd.sevalla.app/",
      });

      newUser.clerkId = invitation.userId;
      await newUser.save();
    }

    res.status(201).json({ message: "Farmer created successfully", newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create farmer" });
  }
};
