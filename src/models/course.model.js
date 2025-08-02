import mongoose, { Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";
const courseSchema = new Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    courseId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    courseName: {
      type: String,
      required: true,
      trim: true,
    },
    courseShortName: {
      type: String,
      required: true,
      trim: true,
    },
    credits: {
      type: Number,
      required: true,
      min: 0,
    },
    isLab: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Course = mongoose.model("Course", courseSchema);
