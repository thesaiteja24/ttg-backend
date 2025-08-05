import mongoose, { Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

const yearSemesterSchema = new Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    year: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 2,
    },
    branch: {
      type: String,
      required: true,
      set: (v) => v.toUpperCase(),
      trim: true,
      validate: {
        validator: function (v) {
          return /^[A-Z-]+$/.test(v); // Only uppercase letters and hyphen
        },
        message:
          "Branch must contain only uppercase letters (A–Z) and hyphens (-), with no numbers or special characters",
      },
    },

    sections: {
      type: [String],
      required: true,
      validate: {
        validator: function (arr) {
          return arr.length > 0;
        },
        message:
          "Sections must be a non-empty array of valid section identifiers (e.g., A, B, C, R)",
      },
    },
  },
  {
    timestamps: true,
  }
);

yearSemesterSchema.virtual("classes", {
  ref: "Class",
  localField: "_id",
  foreignField: "yearSemesterId",
});

yearSemesterSchema.set("toJSON", {
  virtuals: true, // Keep virtuals like "classes"
  transform: (doc, ret) => {
    delete ret.id; // Remove the virtual "id" field
    return ret;
  },
});
yearSemesterSchema.set("toObject", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.id; // Remove the virtual "id" field
    return ret;
  },
});

yearSemesterSchema.index({ year: 1, semester: 1, branch: 1 }, { unique: true });

export const YearSemester = mongoose.model("YearSemester", yearSemesterSchema);
