import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validationResult } from "express-validator";
import { Course } from "../models/course.model.js";

export const createCourse = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation failed",
      errors.array().map((err) => err.msg)
    );
  }

  const { courseId, courseName, courseShortName, credits, isLab } = req.body;

  const existingCourse = await Course.findOne({ courseId });

  if (existingCourse) {
    throw new ApiError(409, "A course with the course ID already exists");
  }

  const course = await Course.create({
    courseId,
    courseName,
    courseShortName,
    credits,
    isLab,
  });

  const createdCourse = await Course.findById(course._id);

  if (!createdCourse) {
    throw new ApiError(500, "Somenthing went wrong while creating the course");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdCourse, "Course created successfully"));
});

export const editCourse = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation failed",
      errors.array().map((err) => err.msg)
    );
  }

  const { id, courseId, courseName, courseShortName, credits, isLab } =
    req.body;

  const course = await Course.findById(id);

  if (!course) {
    throw new ApiError(404, "Course does not exist");
  }

  const existingCourseId = await Course.findOne({ courseId, _id: { $ne: id } });

  if (existingCourseId) {
    throw new ApiError(409, "Course with course ID already exists");
  }

  course.courseId = courseId;
  course.courseName = courseName;
  course.courseShortName = courseShortName;
  course.credits = credits;
  course.isLab = isLab;

  await course.save({ validateBeforeSave: false });

  const newCourse = await Course.findById(course._id);

  if (!newCourse) {
    throw new ApiError(500, "Somenthing went wrong when updating course");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, req.body, "Course updated successfully"));
});
