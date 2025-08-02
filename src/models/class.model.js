import mongoose, { mongo, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

const classSchema = new Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    section: {
      type: String,
      requried: true,
    },
    year: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    semster: {
      type: Number,
      required: true,
      min: 1,
      max: 2,
    },
    branch: {
      type: String,
      required: true,
      enum: ["CSE"],
    },
  },
  {
    timestamps: true,
  }
);

export const Class = mongoose.model("Class", classSchema);
