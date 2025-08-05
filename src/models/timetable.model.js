import mongoose, { mongo, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

const timetableSchema = new Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    classId: {
      type: String,
      ref: "Class",
      required: true,
    },
    courseId: {
      type: String,
      ref: "Course",
      require: true,
    },
    facultyId: {
      type: String,
      ref: "User",
      required: true,
    },
    timeslotId: {
      type: String,
      ref: "User",
      required: true,
    },
    room: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Timetable = new mongoose.model("Timetable", timetableSchema);
