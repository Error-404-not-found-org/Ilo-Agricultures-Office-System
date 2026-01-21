import mongoose from "mongoose";

const InseminationSchema = new mongoose.Schema(
  {
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    animal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Animal",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    estrus: {
      type: String,
      enum: ["Natural", "Synchronized"],
    },

    sireBreed: {
      type: String,
      required: true,
    },

    sireCode: {
      type: String,
      required: true,
    },

    technician: {
      type: String,
    },
  },
  { timestamps: true },
);

export const Insemination = mongoose.model("Insemination", InseminationSchema);
