import mongoose from "mongoose";

const InventorySchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      unique: true,
    },
    category: {
      type: String,
      enum: ["semen", "medicine", "supplies"],
      required: true,
    },
    currentStock: {
      type: Number,
      required: true,
      default: 0,
    },
    unit: {
      type: String,
      default: "pcs", // e.g., 'straws', 'vials', 'bottles', 'pcs'
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    // If it's a semen straw, we connect it to a specific sire
    sireCode: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export const Inventory = mongoose.model("Inventory", InventorySchema);
