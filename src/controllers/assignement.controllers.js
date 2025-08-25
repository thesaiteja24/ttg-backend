import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validationResult } from "express-validator";
import mongoose from "mongoose";
import { Course } from "../models/course.model.js";
import { User } from "../models/user.model.js";
import { Class } from "../models/class.model.js";
import { Assignment } from "../models/assignment.model.js";

export const createAssignment = asyncHandler(async (req, res) => {
  // Validate request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation failed",
      errors.array().map((err) => err?.msg)
    );
  }

  const { courseId, facultyId, classId } = req.body;

  // Check for required fields
  if (!courseId || !facultyId || !classId) {
    throw new ApiError(400, "courseId, facultyId, and classId are required");
  }

  // Start a transaction
  const session = await mongoose.startSession();
  req.session = session; // Attach session for global error handler
  session.startTransaction();

  // Validate course exists
  const course = await Course.findById(courseId, {}, { session });
  if (!course) {
    throw new ApiError(404, "The selected course does not exist");
  }

  // Validate faculty exists and is a faculty member
  const faculty = await User.findById(facultyId, {}, { session });
  if (!faculty || faculty.role !== "faculty") {
    throw new ApiError(
      404,
      "The selected faculty does not exist or is not a faculty member"
    );
  }

  // Validate class exists
  const classData = await Class.findById(classId, {}, { session });
  if (!classData) {
    throw new ApiError(404, "The selected class does not exist");
  }

  // Validate course and class compatibility
  if (
    course.yearSemesterId.toString() !== classData.yearSemesterId.toString()
  ) {
    throw new ApiError(
      400,
      "The selected course is not meant for the selected class's year-semester"
    );
  }

  // Check for existing assignment
  const existingAssignment = await Assignment.findOne(
    { courseId, classId },
    {},
    { session }
  ).populate("facultyId");

  if (existingAssignment) {
    throw new ApiError(
      409,
      `The course ${course.courseName} for class ${classData.section} is already assigned to faculty ${existingAssignment.facultyId.name}`
    );
  }

  // Create assignment
  const [assignment] = await Assignment.create(
    [{ courseId, facultyId, classId }],
    { session }
  );

  // Fetch created assignment with populated fields
  const createdAssignment = await Assignment.findById(assignment._id)
    .populate("courseId", "courseId courseName yearSemesterId")
    .populate("facultyId", "name email")
    .populate("classId", "section yearSemesterId")
    .session(session);

  // Verify assignment creation
  if (!createdAssignment) {
    throw new ApiError(
      500,
      "Something went wrong when creating the assignment"
    );
  }

  // Commit the transaction
  await session.commitTransaction();
  await session.endSession();
  req.session = null; // Clear session

  return res
    .status(201)
    .json(
      new ApiResponse(201, createdAssignment, "Assignment created successfully")
    );
});

export const getAssignment = asyncHandler(async (req, res) => {
  const { yearSemesterId = null } = req.query;

  const pipeline = [
    {
      $lookup: {
        from: "courses",
        localField: "courseId",
        foreignField: "_id",
        as: "course",
        pipeline: [
          { $project: { _id: 1, courseName: 1, yearSemesterId: 1 } },
          {
            $lookup: {
              from: "yearsemesters",
              localField: "yearSemesterId",
              foreignField: "_id",
              as: "yearSemester",
              pipeline: [{ $project: { _id: 1, year: 1, semester: 1 } }],
            },
          },
          { $unwind: "$yearSemester" },
          { $unset: ["yearSemesterId"] }
        ],
      },
    },
    { $unwind: "$course" },

    // conditionally push the $match stage only if yearSemesterId exists
    ...(yearSemesterId
      ? [{ $match: { "course.yearSemesterId": yearSemesterId } }]
      : []),

    {
      $lookup: {
        from: "users",
        localField: "facultyId",
        foreignField: "_id",
        as: "faculty",
        pipeline: [{ $project: { _id: 1, name: 1, email: 1 } }],
      },
    },
    { $unwind: "$faculty" },
    {
      $lookup: {
        from: "classes",
        localField: "classId",
        foreignField: "_id",
        as: "class",
        pipeline: [{ $project: { _id: 1, section: 1, yearSemesterId: 1 } }],
      },
    },
    { $unwind: "$class" },
    { $unset: ["courseId", "facultyId", "classId", "__v"] },
  ];

  const assignments = await Assignment.aggregate(pipeline);

  if (!assignments || assignments.length === 0) {
    throw new ApiError(
      404,
      "No assignments found for the specified year-semester"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, assignments, "Assignments retrieved successfully")
    );
});
