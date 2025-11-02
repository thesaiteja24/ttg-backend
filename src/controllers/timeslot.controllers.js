import { Timeslot } from "../models/timeslot.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getTimeSlots = asyncHandler(async (req, res) => {
  const timeslots = await Timeslot.aggregate([
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
    { $project: { dayOrder: 0 } },
  ]);

  if (timeslots.length === 0) {
    return res.status(404).json(new ApiResponse(404, [], "No timeslots found"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, timeslots, "Timeslots retrieved successfully"));
});

export const createTimeSlot = asyncHandler(async (req, res) => {
  const existing = await Timeslot.countDocuments();
  if (existing > 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "Timeslots already exist"));
  }

  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const timeslots = days.flatMap((day) =>
    Array.from({ length: 6 }, (_, i) => ({ day, period: i + 1 }))
  );

  const newTimeslots = await Timeslot.insertMany(timeslots);

  return res
    .status(201)
    .json(new ApiResponse(201, newTimeslots, "Timeslots created successfully"));
});
