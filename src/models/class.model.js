import mongoose, { Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { YearSemester } from "./yearSemester.model.js";

const classSchema = new Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    yearSemesterId: {
      type: String,
      required: true,
      ref: "YearSemester",
    },
    section: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

classSchema.pre("save", async function (next) {
  const yearSemester = await YearSemester.findById(this.yearSemesterId);
  if (!yearSemester) {
    return next(new Error("YearSemester not found"));
  }
  if (!yearSemester.sections.includes(this.section)) {
    return next(new Error("Invalid section for this year-semester"));
  }
  next();
});

classSchema.index({ yearSemesterId: 1, section: 1 }, { unique: true });

export const Class = mongoose.model("Class", classSchema);
