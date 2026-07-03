import { SupportTicket } from "../models/support-ticket.model.js";

// POST /api/support-tickets
export const createSupportTicket = async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "Message is required to submit a ticket." });
    }

    const ticket = await SupportTicket.create({
      userId: req.user._id,
      name: req.user.name || "Client",
      email: req.user.email || "",
      phoneNumber: req.user.phoneNumber || "",
      message: message.trim(),
    });

    console.log(`[Support Ticket Created] User: ${req.user._id} | Ticket: ${ticket._id}`);

    res.status(201).json({
      message: "Support ticket submitted successfully.",
      ticket,
    });
  } catch (error) {
    console.error("[createSupportTicket ERROR]", error.message);
    res.status(500).json({ message: error.message || "Failed to submit support ticket." });
  }
};

export const listSupportTickets = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const query = {};

    if (req.query.status && req.query.status !== "all") {
      query.status = req.query.status;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .populate("userId", "name role email phoneNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(query),
    ]);

    res.status(200).json({
      data: tickets,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[listSupportTickets ERROR]", error.message);
    res.status(500).json({ message: "Failed to fetch support tickets." });
  }
};

export const updateSupportTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "in-progress", "resolved"].includes(status)) {
      return res.status(400).json({ message: "Invalid support ticket status." });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true },
    ).populate("userId", "name role email phoneNumber");

    if (!ticket) {
      return res.status(404).json({ message: "Support ticket not found." });
    }

    res.status(200).json({ message: "Support ticket updated.", data: ticket });
  } catch (error) {
    console.error("[updateSupportTicketStatus ERROR]", error.message);
    res.status(500).json({ message: "Failed to update support ticket." });
  }
};
