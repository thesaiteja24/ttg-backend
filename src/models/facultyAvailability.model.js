import mongoose, { Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

const facultyAvailablitySchema = new Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    facultyId: {
      type: String,
      ref: "User",
      required: true,
    },
    timeslotId: {
      type: String,
      ref: "Timeslot",
      required: true,
    },
    isAvailable: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

facultyAvailablitySchema.index({ facultyId: 1, timeslotId: 1 }, { unique: true });

export const FacultyAvailability = mongoose.model(
  "FacultyAvailability",
  facultyAvailablitySchema
);
