import mongoose, { Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

const assignmentSchema = new Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    courseId: {
      type: String,
      ref: "Course",
      required: true,
    },
    facultyId: {
      type: String,
      ref: "User",
      required: true,
    },
    classId: {
      type: String,
      ref: "Class",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Assignment = mongoose.model("Assignment", assignmentSchema);
