import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const timeslotSchema = new Schema(
  {
    _id: {
      String,
      default: uuidv4,
    },
    day: {
      type: String,
      requried: true,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
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

export const TimeSlot = mongoose.model("TimeSlot", timeslotSchema);
