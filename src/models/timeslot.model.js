import mongoose, { Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

const timeslotSchema = new Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    day: {
      type: String,
      required: true,
      enum: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ],
      trim: true,
    },
    period: {
      type: Number,
      required: true,
      min: 1,
      max: 6,
    },
  },
  {
    timestamps: true,
  }
);

timeslotSchema.index({ day: 1, period: 1 }, { unique: true });

export const Timeslot = mongoose.model("Timeslot", timeslotSchema);
