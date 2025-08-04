import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validationResult } from "express-validator";
import bcrypt from "bcrypt";
import { User } from "../models/user.model.js";
import { Course } from "../models/course.model.js";

const generateEmailFromPhone = (phone, domain = "ttg.org") => {
  return `faculty_${phone}@${domain}`;
};

const generatePassword = async () => {
  const password = process.env.FACULTY_PASSWORD;
  return await bcrypt.hash(password, 12);
};

export const createFaculty = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation failed",
      errors.array().map((err) => err.msg)
    );
  }

  const { name, countryCode, phone } = req.body;

  const existingFaculty = await User.findOne({ phone });

  if (existingFaculty) {
    throw new ApiError(409, "Faculty with same contact number already exists");
  }

  const email = generateEmailFromPhone(phone);
  const password = await generatePassword();

  const faculty = await User.create({
    name,
    email,
    password,
    countryCode,
    phone,
    role: "faculty",
  });

  const newFaculty = await User.findById(faculty._id).select(
    "-password -refreshToken"
  );

  if (!newFaculty) {
    throw new ApiError(500, "Somenthing went wrong while creating the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, newFaculty, "Faculty created successfully"));
});

export const editFaculty = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation failed",
      errors.array().map((err) => err.msg)
    );
  }

  const { facultyId, name, countryCode, phone } = req.body;

  const faculty = await User.findById(facultyId);

  if (!faculty || faculty.role !== "faculty") {
    throw new ApiError(404, "Faculty does not exists");
  }

  const existingPhone = await User.findOne({
    phone,
    _id: { $ne: facultyId },
  });

  if (existingPhone) {
    throw new ApiError(409, "Phone number already in use by another faculty");
  }

  const newEmail = generateEmailFromPhone(phone);

  const existingEmail = await User.findOne({
    email: newEmail,
    _id: { $ne: facultyId },
  });

  if (existingEmail) {
    throw new ApiError(
      409,
      "Generated email already in use by another faculty"
    );
  }

  faculty.name = name;
  faculty.phone = phone;
  faculty.email = newEmail;
  faculty.countryCode = countryCode;

  await faculty.save({ validateBeforeSave: false });

  const updatedFaculty = await User.findById(faculty._id);

  if (!updatedFaculty) {
    throw new ApiError(500, "Somenthing went wrong when updating faculty");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedFaculty, "Faculty data updated successfully")
    );
});

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

  const createdCourse = await Course.findById(course._id).select(
    "-createdAt -updatedAt"
  );

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
