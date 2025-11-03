import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validationResult } from "express-validator";
import bcrypt from "bcrypt";
import { User } from "../models/user.model.js";
import mongoose from "mongoose";
import { FacultyAvailability } from "../models/facultyAvailability.model.js";
import { Timeslot } from "../models/timeslot.model.js";

const generateEmailFromPhone = (phone, domain = "ttg.org") => {
  return `faculty_${phone}@${domain}`;
};

const generatePassword = async () => {
  const password = process.env.FACULTY_PASSWORD;
  return await bcrypt.hash(password, 12);
};

export const getFaculty = asyncHandler(async (req, res) => {
  const users = await User.find({ role: "faculty" })
    .select("-email -password -createdAt -updatedAt -__v")
    .sort({ name: 1 });

  if (users.length === 0) {
    throw new ApiError(404, "Faculty does not exist");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, users, "Faculty fetched successfully"));
});

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

  const session = await mongoose.startSession();
  req.session = session;
  session.startTransaction();

  const existingFaculty = await User.findOne({ phone }).session(session);
  if (existingFaculty) {
    throw new ApiError(409, "Faculty with same contact number already exists");
  }

  const email = generateEmailFromPhone(phone);
  const password = await generatePassword();

  const [faculty] = await User.create(
    [{ name, email, password, countryCode, phone, role: "faculty" }],
    { session }
  );

  const newFaculty = await User.findById(faculty._id)
    .session(session)
    .select("-password -refreshToken");

  if (!newFaculty) {
    throw new ApiError(500, "Something went wrong while creating the user");
  }

  // create default availability for the new faculty
  const timeslotIds = await Timeslot.aggregate([
    {
      $addFields: {
        dayOrder: {
          $switch: {
            branches: [
              { case: { $eq: ["$day", "monday"] }, then: 1 },
              { case: { $eq: ["$day", "tuesday"] }, then: 2 },
              { case: { $eq: ["$day", "wednesday"] }, then: 3 },
              { case: { $eq: ["$day", "thursday"] }, then: 4 },
              { case: { $eq: ["$day", "friday"] }, then: 5 },
              { case: { $eq: ["$day", "saturday"] }, then: 6 },
            ],
            default: 7,
          },
        },
      },
    },
    { $sort: { dayOrder: 1, period: 1 } },
    { $project: { _id: 1 } },
  ]);

  if (timeslotIds.length === 0) {
    throw new ApiError(
      500,
      "No timeslots found to create faculty availability"
    );
  }

  const availabilitySlots = timeslotIds.map((timeslotId) => ({
    facultyId: faculty._id,
    timeslotId: timeslotId,
    isAvailable: true,
  }));

  await FacultyAvailability.insertMany(availabilitySlots, { session });

  const facultyAvailability = await FacultyAvailability.find({
    facultyId: faculty._id,
  })
    .session(session)
    .populate("timeslotId");

  if (!facultyAvailability) {
    throw new ApiError(
      500,
      "Something went wrong while creating faculty availability"
    );
  }

  await session.commitTransaction();
  await session.endSession();
  req.session = null;

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

  const { id, name, countryCode, phone } = req.body;

  const session = await mongoose.startSession();
  req.session = session;
  session.startTransaction();

  const faculty = await User.findById(id).session(session);
  if (!faculty || faculty.role !== "faculty") {
    throw new ApiError(404, "Faculty does not exist");
  }

  const existingPhone = await User.findOne({
    phone,
    _id: { $ne: id },
  }).session(session);

  if (existingPhone) {
    throw new ApiError(409, "Phone number already in use by another faculty");
  }

  const newEmail = generateEmailFromPhone(phone);

  const existingEmail = await User.findOne({
    email: newEmail,
    _id: { $ne: id },
  }).session(session);

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

  // check for faculty availability entries and create if not existing
  const facultyAvailabilityCount = await FacultyAvailability.countDocuments({
    facultyId: faculty._id,
  }).session(session);

  if (facultyAvailabilityCount === 0) {
    const timeslotIds = await Timeslot.aggregate([
      {
        $addFields: {
          dayOrder: {
            $switch: {
              branches: [
                { case: { $eq: ["$day", "monday"] }, then: 1 },
                { case: { $eq: ["$day", "tuesday"] }, then: 2 },
                { case: { $eq: ["$day", "wednesday"] }, then: 3 },
                { case: { $eq: ["$day", "thursday"] }, then: 4 },
                { case: { $eq: ["$day", "friday"] }, then: 5 },
                { case: { $eq: ["$day", "saturday"] }, then: 6 },
              ],
              default: 7,
            },
          },
        },
      },
      { $sort: { dayOrder: 1, period: 1 } },
      { $project: { _id: 1 } },
    ]).session(session);

    if (timeslotIds.length === 0) {
      throw new ApiError(
        500,
        "No timeslots found to create faculty availability"
      );
    }

    const availabilitySlots = timeslotIds.map((timeslotId) => ({
      facultyId: faculty._id,
      timeslotId: timeslotId,
      isAvailable: true,
    }));

    await FacultyAvailability.insertMany(availabilitySlots, { session });
  }

  await faculty.save({ validateBeforeSave: false, session });

  const updatedFaculty = await User.findById(faculty._id)
    .session(session)
    .select("-password -refreshToken");

  if (!updatedFaculty) {
    throw new ApiError(500, "Something went wrong when updating faculty");
  }

  await session.commitTransaction();
  await session.endSession();
  req.session = null;

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedFaculty, "Faculty data updated successfully")
    );
});

export const deleteFaculty = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  req.session = session; // Attach session to req
  session.startTransaction();

  const faculty = await User.findById(id, {}, { session });

  if (!faculty || faculty.role !== "faculty") {
    throw new ApiError(404, "Faculty does not exist");
  }

  const facultyAvailabilities = await FacultyAvailability.deleteMany(
    { facultyId: id },
    { session }
  );

  if (facultyAvailabilities.deletedCount === 0) {
    throw new ApiError(
      500,
      "Something went wrong while deleting faculty availability"
    );
  }

  const deletedUser = await User.findByIdAndDelete(id, { session });

  if (!deletedUser) {
    throw new ApiError(500, "Something went wrong while deleting the user");
  }

  // Commit the transaction
  await session.commitTransaction();
  await session.endSession();
  req.session = null; // Clear session from req

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Faculty deleted successfully"));
});

export const facultyAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const faculty = await User.findById(id);

  if (!faculty || faculty.role !== "faculty") {
    throw new ApiError(404, "Faculty does not exist");
  }

  console.log(faculty);

  const schedule = await FacultyAvailability.aggregate([
    { $match: { facultyId: faculty._id } },
    {
      $lookup: {
        from: "timeslots",
        localField: "timeslotId",
        foreignField: "_id",
        as: "timeslot",
      },
    },
    { $unwind: "$timeslot" },
    {
      $addFields: {
        order: {
          $switch: {
            branches: [
              { case: { $eq: ["$timeslot.day", "monday"] }, then: 1 },
              { case: { $eq: ["$timeslot.day", "tuesday"] }, then: 2 },
              { case: { $eq: ["$timeslot.day", "wednesday"] }, then: 3 },
              { case: { $eq: ["$timeslot.day", "thursday"] }, then: 4 },
              { case: { $eq: ["$timeslot.day", "friday"] }, then: 5 },
              { case: { $eq: ["$timeslot.day", "saturday"] }, then: 6 },
            ],
            default: 7,
          },
        },
      },
    },
    { $sort: { order: 1, "timeslot.period": 1 } },
    {
      $project: {
        _id: 1,
        day: "$timeslot.day",
        period: "$timeslot.period",
        isAvailable: 1,
      },
    },
    {
      $group: {
        _id: faculty._id,
        facultyAvailability: { $push: "$$ROOT" },
      },
    },
    {
      $project: {
        _id: 1,
        "facultyAvailability._id": 1,
        "facultyAvailability.day": 1,
        "facultyAvailability.period": 1,
        "facultyAvailability.isAvailable": 1,
      },
    },
  ]);


  if (schedule.length === 0) {
    throw new ApiError(404, "Schedule does not exist for that faculty");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, schedule, "Schedule fetched successfully"));
});
