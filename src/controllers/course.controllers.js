import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validationResult } from "express-validator";
import { Course } from "../models/course.model.js";
import { YearSemester } from "../models/yearSemester.model.js";
import mongoose from "mongoose";

export const createCourse = asyncHandler(async (req, res) => {
  // Validate request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation failed",
      errors.array().map((err) => err.msg)
    );
  }

  const {
    yearSemesterId,
    courseId,
    courseName,
    courseShortName,
    credits,
    isLab,
  } = req.body;

  // Check for missing yearSemesterId
  if (!yearSemesterId) {
    throw new ApiError(400, "yearSemesterId is required");
  }

  // Start a transaction
  const session = await mongoose.startSession();
  req.session = session; // Attach session to req for global error handler

  session.startTransaction();

  // Validate yearSemesterId exists
  const existingYearSemester = await YearSemester.findById(
    yearSemesterId,
    {},
    { session }
  );
  if (!existingYearSemester) {
    throw new ApiError(404, "Selected Year and Semester does not exist");
  }

  // Check for duplicate courseId
  const existingCourse = await Course.findOne({ courseId }, {}, { session });
  if (existingCourse) {
    throw new ApiError(409, "A course with this course ID already exists");
  }

  // Create course
  const [course] = await Course.create(
    [
      {
        yearSemesterId,
        courseId,
        courseName,
        courseShortName,
        credits,
        isLab,
      },
    ],
    { session }
  );

  // Fetch created course with populated yearSemesterId
  const createdCourse = await Course.findById(course._id)
    .populate("yearSemesterId", "year semester branch")
    .session(session);

  // Verify course and population
  if (!createdCourse || !createdCourse.yearSemesterId) {
    throw new ApiError(
      500,
      "Failed to create course: Invalid or missing yearSemesterId reference"
    );
  }

  // Commit the transaction
  await session.commitTransaction();
  await session.endSession();
  req.session = null; // Clear session from req

  return res
    .status(201)
    .json(new ApiResponse(201, createdCourse, "Course created successfully"));
});

export const editCourse = asyncHandler(async (req, res) => {
  // Validate request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation failed",
      errors.array().map((err) => err.msg)
    );
  }

  const {
    id,
    yearSemesterId,
    courseId,
    courseName,
    courseShortName,
    credits,
    isLab,
  } = req.body;

  // Start a transaction
  const session = await mongoose.startSession();
  req.session = session; // Attach session to req
  session.startTransaction();

  // Check for course existence
  const course = await Course.findById(id, {}, { session });
  if (!course) {
    throw new ApiError(404, "Course does not exist");
  }

  // Validate yearSemesterId if provided
  if (yearSemesterId) {
    const existingYearSemester = await YearSemester.findById(
      yearSemesterId,
      {},
      { session }
    );
    if (!existingYearSemester) {
      throw new ApiError(404, "Selected Year and Semester does not exist");
    }
  }

  // Check for duplicate courseId
  if (courseId) {
    const existingCourseId = await Course.findOne(
      { courseId, _id: { $ne: id } },
      {},
      { session }
    );
    if (existingCourseId) {
      throw new ApiError(409, "Course with this course ID already exists");
    }
  }

  // Build update fields dynamically
  const updateFields = {};
  if (yearSemesterId) updateFields.yearSemesterId = yearSemesterId;
  if (courseId) updateFields.courseId = courseId;
  if (courseName) updateFields.courseName = courseName;
  if (courseShortName) updateFields.courseShortName = courseShortName;
  if (credits !== undefined) updateFields.credits = credits;
  if (isLab !== undefined) updateFields.isLab = isLab;

  // Update course
  const updatedCourse = await Course.findByIdAndUpdate(
    id,
    { $set: updateFields },
    { new: true, runValidators: true, session }
  ).populate("yearSemesterId", "year semester branch sections");

  // Verify update and population
  if (!updatedCourse || (yearSemesterId && !updatedCourse.yearSemesterId)) {
    throw new ApiError(
      500,
      "Failed to update course: Invalid or missing yearSemesterId reference"
    );
  }

  // Commit the transaction
  await session.commitTransaction();
  await session.endSession();
  req.session = null; // Clear session from req

  return res
    .status(200)
    .json(new ApiResponse(200, updatedCourse, "Course updated successfully"));
});

export const getCourse = asyncHandler(async (req, res) => {
  const { yearSemesterId = null } = req.query;
  let filter = {};

  if (yearSemesterId !== null) {
    filter.yearSemesterId = yearSemesterId;
  }

  const courses = await Course.find(filter)
    .populate("yearSemesterId", "year semester branch sections")
    .select("-createdAt -updatedAt -__v")
    .sort({ courseId: 1 });

  if (courses.length === 0) {
    throw new ApiError(404, "Courses does not exist");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, courses, "Courses fetched successfully"));
});

export const deleteCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Start a transaction
  const session = await mongoose.startSession();
  req.session = session; // Attach session to req
  session.startTransaction();

  // Check for course existence
  const course = await Course.findById(id, {}, { session });
  if (!course) {
    throw new ApiError(404, "Course does not exist");
  }

  // Delete course
  await Course.findByIdAndDelete(id, { session });

  // Commit the transaction
  await session.commitTransaction();
  await session.endSession();
  req.session = null; // Clear session from req

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Course deleted successfully"));
});
