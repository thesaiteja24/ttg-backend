import mongoose from "mongoose";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validationResult } from "express-validator";
import { YearSemester } from "../models/yearSemester.model.js";
import { Class } from "../models/class.model.js";
import { Assignment } from "../models/assignment.model.js";
import { Timetable } from "../models/timetable.model.js";

export const createYearSemester = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation Error",
      errors.array().map((err) => err?.msg)
    );
  }

  const { year, semester, branch, sections } = req.body;

  const existingYearSemester = await YearSemester.findOne({
    year,
    semester,
    branch,
  });
  if (existingYearSemester) {
    throw new ApiError(
      409,
      `Year-semester ${year}-${semester} for branch ${branch} already exists`
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const yearSemester = await YearSemester.create(
      [{ year, semester, branch, sections }],
      { session }
    );
    const yearSemesterId = yearSemester[0]._id;

    const classDocs = sections.map((section) => ({
      yearSemesterId,
      section,
      status: "active",
    }));
    await Class.insertMany(classDocs, { session });

    await session.commitTransaction();

    const createdYearSemester = await YearSemester.findById(yearSemesterId)
      .populate("classes", "section status")
      .select("-createdAt -updatedAt -__v");

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          createdYearSemester,
          "Year-semester and classes created successfully"
        )
      );
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(500, `Failed to create year-semester: ${error.message}`);
  } finally {
    await session.endSession();
  }
});

export const editYearSemester = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation Error",
      errors.array().map((err) => err?.msg)
    );
  }

  const { id, year, semester, branch, sections } = req.body;

  const yearSemester = await YearSemester.findById(id);
  if (!yearSemester) {
    throw new ApiError(404, "Year-semester does not exist");
  }

  const existingYearSemester = await YearSemester.findOne({
    year,
    semester,
    branch,
    _id: { $ne: id },
  });
  if (existingYearSemester) {
    throw new ApiError(
      409,
      `Year-semester ${year}-${semester} for branch ${branch} already exists`
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find existing classes
    const existingClasses = await Class.find({ yearSemesterId: id }).session(
      session
    );
    const existingSections = existingClasses.map((cls) => cls.section);

    // Sections to add
    const sectionsToAdd = sections.filter(
      (section) => !existingSections.includes(section)
    );
    const classDocsToAdd = sectionsToAdd.map((section) => ({
      yearSemesterId: id,
      section,
      status: "active",
    }));

    // Sections to remove
    const sectionsToRemove = existingSections.filter(
      (section) => !sections.includes(section)
    );
    for (const section of sectionsToRemove) {
      const classDoc = existingClasses.find((cls) => cls.section === section);
      const assignmentCount = await Assignment.countDocuments({
        classId: classDoc._id,
      }).session(session);
      const timetableCount = await Timetable.countDocuments({
        classId: classDoc._id,
      }).session(session);
      if (assignmentCount > 0 || timetableCount > 0) {
        throw new ApiError(
          400,
          `Cannot remove section ${section} because it has ${assignmentCount} assignment(s) and ${timetableCount} timetable entry(ies)`
        );
      }
    }

    // Update YearSemester
    const updatedYearSemester = await YearSemester.findByIdAndUpdate(
      id,
      { $set: { year, semester, branch, sections } },
      { new: true, runValidators: true, session }
    );

    // Create new classes
    if (classDocsToAdd.length > 0) {
      await Class.insertMany(classDocsToAdd, { session });
    }

    // Delete removed classes
    if (sectionsToRemove.length > 0) {
      await Class.deleteMany(
        { yearSemesterId: id, section: { $in: sectionsToRemove } },
        { session }
      );
    }

    await session.commitTransaction();

    const populatedYearSemester = await YearSemester.findById(id)
      .populate("classes", "section status")
      .select("-createdAt -updatedAt -__v");

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          populatedYearSemester,
          "Year-semester and classes updated successfully"
        )
      );
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(500, `Failed to update year-semester: ${error.message}`);
  } finally {
    await session.endSession();
  }
});

export const deleteYearSemester = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation Error",
      errors.array().map((err) => err?.msg)
    );
  }

  const { id } = req.body;

  const yearSemester = await YearSemester.findById(id);
  if (!yearSemester) {
    throw new ApiError(404, "Year-semester does not exist");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const classes = await Class.find({ yearSemesterId: id }).session(session);
    for (const classDoc of classes) {
      const assignmentCount = await Assignment.countDocuments({
        classId: classDoc._id,
      }).session(session);
      const timetableCount = await Timetable.countDocuments({
        classId: classDoc._id,
      }).session(session);
      if (assignmentCount > 0 || timetableCount > 0) {
        throw new ApiError(
          400,
          `Cannot delete year-semester because section ${classDoc.section} has ${assignmentCount} assignment(s) and ${timetableCount} timetable entry(ies)`
        );
      }
    }

    await Class.deleteMany({ yearSemesterId: id }, { session });
    const deletedYearSemester = await YearSemester.findByIdAndDelete(id, {
      session,
    }).select("-createdAt -updatedAt -__v");

    await session.commitTransaction();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          deletedYearSemester,
          "Year-semester and classes deleted successfully"
        )
      );
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(500, `Failed to delete year-semester: ${error.message}`);
  } finally {
    await session.endSession();
  }
});

export const getYearSemesters = asyncHandler(async (req, res) => {
  const { isDropdown = false } = req.query;

  let query = YearSemester.find()
    .sort({ year: 1, semester: 1, branch: 1 })
    .select("-createdAt -updatedAt -__v");

  if (!isDropdown) {
    query = query.populate("classes", "section status");
  }

  const yearSemesters = await query;

  if (yearSemesters.length === 0) {
    throw new ApiError(404, "No year-semesters exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, yearSemesters, "Year-semesters fetched successfully")
    );
});
