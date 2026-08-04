import mongoose from "mongoose";

const idempotencySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // UserId is required for user-scoped idempotency
    },
    method: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    responseStatus: {
      type: Number,
      required: false,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
    // Status can be: 'pending' or 'resolved'
    status: {
      type: String,
      enum: ["pending", "resolved"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Compound unique index for user-scoped method/path idempotency
idempotencySchema.index({ userId: 1, key: 1, method: 1, path: 1 }, { unique: true });

// TTL index to automatically remove keys after 24 hours
idempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export const Idempotency = mongoose.model("Idempotency", idempotencySchema);
