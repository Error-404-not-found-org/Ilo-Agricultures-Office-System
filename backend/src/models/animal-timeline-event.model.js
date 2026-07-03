import mongoose from "mongoose";

const AnimalTimelineEventSchema = new mongoose.Schema(
  {
    animalId: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", required: true, index: true },
    eventType: { type: String, required: true, index: true },
    occurredAt: { type: Date, default: Date.now, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sourceType: { type: String, required: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    title: { type: String, required: true },
    summary: { type: String, default: "" },
    attachments: { type: [String], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

AnimalTimelineEventSchema.index({ animalId: 1, occurredAt: -1 });

export const AnimalTimelineEvent = mongoose.model("AnimalTimelineEvent", AnimalTimelineEventSchema);
