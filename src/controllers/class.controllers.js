import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validationResult } from "express-validator";
import { Class } from "../models/class.model.js";

export const createClass = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation Error",
      errors.array().map((err) => err?.msg)
    );
  }

  const { section, year, semester, branch } = req.body;

  const existingClass = await Class.findOne({
    section,
    year,
    semester,
    branch,
  });

  if (existingClass) {
    throw new ApiError(
      409,
      `Class for ${branch} ${section}, ${year}-${semester} already exists`
    );
  }

  const createClass = await Class.create({ section, year, semester, branch });

  const newClass = await Class.findById(createClass._id);

  if (!newClass) {
    throw new ApiError(500, "Somenthing went wrong when creating the class");
  }
  return res
    .status(201)
    .json(new ApiResponse(201, newClass, "Class created successfully"));
});

export const editClass = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation error",
      errors.array().map((err) => err?.msg)
    );
  }

  const { id, section, semester, year, branch } = req.body;

  const classData = await Class.findById(id);

  if (!classData) {
    throw new ApiError(404, "Class does not exist");
  }

  const existingClass = await Class.findOne({
    section,
    semester,
    year,
    branch,
    _id: { $ne: id },
  });

  if (existingClass) {
    throw new ApiError(
      409,
      `Class for ${branch} ${section}, ${year}-${semester} already exists`
    );
  }

  const updatedClass = await Class.findByIdAndUpdate(
    id,
    { $set: { section, semester, year, branch } },
    { new: true, runValidators: true }
  );

  if (!updatedClass) {
    throw new ApiError(500, "Somenthing went wrong when updating the class");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedClass, "Class data updated successfully")
    );
});

export const deleteClass = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation error",
      errors.array().map((err) => err?.msg)
    );
  }

  const { id } = req.body;

  const classData = await Class.findById(id);

  if (!classData) {
    throw new ApiError(404, "Class does not exist");
  }

  const deletedClass = await Class.findByIdAndDelete(id);

  return res
    .status(200)
    .json(new ApiResponse(200, deletedClass, "Class deleted successfully"));
});

export const getClasses = asyncHandler(async (req, res) => {
  const classes = await Class.find()
    .sort({ year: 1, semester: 1, section: 1 })
    .select("-createdAt -updatedAt -__v");

  if (!classes.length === 0) {
    throw new ApiError(404, "No classes exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, classes, "Classes data fetched successfully"));
});
