import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validationResult } from "express-validator";
import mongoose from "mongoose";
import { Assignment } from "../models/assignment.model.js";
import { FacultyAvailability } from "../models/facultyAvailability.model.js";
import { Timetable } from "../models/timetable.model.js";
import { Timeslot } from "../models/timeslot.model.js";
import { Course } from "../models/course.model.js";
import { Class } from "../models/class.model.js";
import { User } from "../models/user.model.js";
import { sendProgress } from "../server.js";

export const generateTimetable = asyncHandler(async (req, res) => {
  console.log("\n========== TIMETABLE GENERATION STARTED ==========");
  console.log("Request body:", JSON.stringify(req.body, null, 2));

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation Error",
      errors.array().map((err) => err.msg)
    );
  }

  const { yearSemesterId } = req?.body;
  console.log(`\n[STEP 1] Year Semester ID: ${yearSemesterId}`);

  const session = await mongoose.startSession();
  session.startTransaction();
  req.session = session;

  try {
    // ---------- Fetch courses and quick global validation ----------
    console.log("\n[STEP 2] Fetching courses...");
    const courses = await Course.find({ yearSemesterId }, {}, { session });
    console.log(
      `Found ${courses.length} courses:`,
      courses.map((c) => ({
        name: c.courseName,
        credits: c.credits,
        isLab: c.isLab,
      }))
    );

    if (!courses || courses.length === 0) {
      throw new ApiError(404, "No courses found for the given yearSemesterId");
    }

    const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
    console.log(`Total credits: ${totalCredits}`);

    if (totalCredits > 36) {
      throw new ApiError(
        400,
        "Total credits for the courses in the given yearSemesterId exceeds 36"
      );
    }

    // ---------- Fetch classes ----------
    console.log("\n[STEP 3] Fetching classes...");
    const classes = await Class.find({ yearSemesterId }, {}, { session });
    console.log(
      `Found ${classes.length} classes:`,
      classes.map((c) => ({
        id: c._id,
        section: c.section,
      }))
    );

    if (!classes || classes.length === 0) {
      throw new ApiError(404, "No classes found for the given yearSemesterId");
    }

    // ---------- Build enriched assignments ----------
    console.log("\n[STEP 4] Building enriched assignments...");
    const aggResults = await Assignment.aggregate([
      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "courseDetails",
          pipeline: [
            { $match: { yearSemesterId } },
            { $project: { _id: 1, courseName: 1, credits: 1, isLab: 1 } },
          ],
        },
      },
      { $unwind: "$courseDetails" },
      {
        $lookup: {
          from: "users",
          localField: "facultyId",
          foreignField: "_id",
          as: "facultyDetails",
          pipeline: [{ $project: { _id: 1, name: 1 } }],
        },
      },
      { $unwind: "$facultyDetails" },
      {
        $lookup: {
          from: "classes",
          localField: "classId",
          foreignField: "_id",
          as: "classDetails",
          pipeline: [{ $project: { _id: 1, section: 1, yearSemesterId: 1 } }],
        },
      },
      { $unwind: "$classDetails" },
      {
        $addFields: {
          courseId: "$courseDetails",
          facultyId: "$facultyDetails",
          classId: "$classDetails",
        },
      },
      {
        $project: {
          courseDetails: 0,
          facultyDetails: 0,
          classDetails: 0,
          __v: 0,
        },
      },
    ]).session(session);

    console.log(`Found ${aggResults.length} assignments:`);
    aggResults.forEach((a, idx) => {
      console.log(
        `  ${idx + 1}. ${a.courseId.courseName} -> ${a.classId.section} (Faculty: ${a.facultyId.name})`
      );
    });

    if (!aggResults || aggResults.length === 0) {
      throw new ApiError(
        404,
        "No valid assignments found for the year-semester"
      );
    }

    const validAssignments = aggResults;

    // ---------- Extract faculty IDs ----------
    const facultyIds = [
      ...new Set(validAssignments.map((a) => a.facultyId._id.toString())),
    ];
    console.log(
      `\n[STEP 5] Unique faculty IDs (${facultyIds.length}):`,
      facultyIds
    );

    // ---------- Fetch timeslots ----------
    console.log("\n[STEP 6] Fetching timeslots...");
    const timeslots = await Timeslot.find({}, {}, { session }).sort({
      day: 1,
      period: 1,
    });
    console.log(`Found ${timeslots.length} timeslots`);

    const timeslotMap = {};
    timeslots.forEach((t) => {
      if (!timeslotMap[t.day]) timeslotMap[t.day] = {};
      timeslotMap[t.day][t.period] = t;
    });
    console.log(
      "Timeslot map structure:",
      Object.keys(timeslotMap).map((day) => ({
        day,
        periods: Object.keys(timeslotMap[day]),
      }))
    );

    // ---------- Reset faculty availability (fresh generation run) ----------
    await FacultyAvailability.updateMany(
      { facultyId: { $in: facultyIds } },
      { $set: { isAvailable: true } },
      { session }
    );

    // ---------- Faculty availability ----------
    console.log("\n[STEP 7] Fetching faculty availability...");
    const availabilityDocs = await FacultyAvailability.find(
      { facultyId: { $in: facultyIds }, isAvailable: true },
      {},
      { session }
    ).populate("timeslotId", "day period");
    console.log(`Found ${availabilityDocs.length} availability records`);

    const availabilityMap = {};
    availabilityDocs.forEach((av) => {
      const fid = av.facultyId.toString();
      availabilityMap[fid] = availabilityMap[fid] || new Set();
      if (av.timeslotId && av.timeslotId._id) {
        availabilityMap[fid].add(av.timeslotId._id.toString());
      }
    });
    console.log("Availability map:");
    Object.entries(availabilityMap).forEach(([fid, slots]) => {
      const faculty = validAssignments.find(
        (a) => a.facultyId._id.toString() === fid
      )?.facultyId;
      console.log(`  ${faculty?.name || fid}: ${slots.size} available slots`);
    });

    // ---------- Existing timetable ----------
    console.log("\n[STEP 8] Fetching existing timetable...");
    const existingTimetable = await Timetable.find(
      { facultyId: { $in: facultyIds } },
      {},
      { session }
    ).populate("timeslotId", "day period");
    console.log(`Found ${existingTimetable.length} existing timetable entries`);

    const facultyTimeslotSets = {};
    facultyIds.forEach((fid) => (facultyTimeslotSets[fid] = new Set()));
    existingTimetable.forEach((entry) => {
      const fid = entry.facultyId.toString();
      if (entry.timeslotId && entry.timeslotId._id) {
        facultyTimeslotSets[fid].add(entry.timeslotId._id.toString());
      }
    });
    console.log("Faculty timeslot sets (existing):");
    Object.entries(facultyTimeslotSets).forEach(([fid, slots]) => {
      if (slots.size > 0) {
        const faculty = validAssignments.find(
          (a) => a.facultyId._id.toString() === fid
        )?.facultyId;
        console.log(`  ${faculty?.name || fid}: ${slots.size} booked slots`);
      }
    });

    // ---------- Per-class credit validation ----------
    console.log("\n[STEP 9] Validating per-class credits...");
    const classCredits = {};
    for (const assignment of validAssignments) {
      const classId = assignment.classId._id.toString();
      classCredits[classId] =
        (classCredits[classId] || 0) + assignment.courseId.credits;
      if (classCredits[classId] > 36) {
        throw new ApiError(
          400,
          `Class ${assignment.classId.section} exceeds 36 credits (total: ${classCredits[classId]})`
        );
      }
    }
    console.log("Class credits:");
    Object.entries(classCredits).forEach(([cid, credits]) => {
      const cls = classes.find((c) => c._id.toString() === cid);
      console.log(`  ${cls?.section || cid}: ${credits} credits`);
    });

    // ---------- Timetable matrix ----------
    console.log("\n[STEP 10] Initializing timetable matrix...");
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const periods = [1, 2, 3, 4, 5, 6];
    const timetableMatrix = {};
    classes.forEach((cls) => {
      const cid = cls._id.toString();
      timetableMatrix[cid] = {};
      days.forEach((day) => {
        timetableMatrix[cid][day] = Array(periods.length).fill(null);
      });
    });
    console.log(
      `Matrix initialized for ${classes.length} classes × ${days.length} days × ${periods.length} periods`
    );

    // ---------- Course assignments ----------
    console.log("\n[STEP 11] Initializing course assignments tracker...");
    const courseAssignments = {};
    validAssignments.forEach((a) => {
      const classId = a.classId._id.toString();
      const courseId = a.courseId._id.toString();
      const key = `${classId}-${courseId}`;
      courseAssignments[key] = {
        required: a.courseId.credits,
        assigned: 0,
        isLab: !!a.courseId.isLab,
        meta: {
          classSection: a.classId.section,
          courseName: a.courseId.courseName,
        },
      };
    });
    console.log("Course assignments:");
    Object.entries(courseAssignments).forEach(([key, info]) => {
      console.log(
        `  ${info.meta.courseName} (${info.meta.classSection}): ${info.required} slots needed, Lab: ${info.isLab}`
      );
    });

    // ---------- Compute possible slots ----------
    console.log("\n[STEP 12] Computing possible slots per assignment...");
    const possibleSlotCounts = {};
    for (const a of validAssignments) {
      const fid = a.facultyId._id.toString();
      const classId = a.classId._id.toString();
      const courseId = a.courseId._id.toString();
      const key = `${classId}-${courseId}`;

      let count = 0;
      for (const day of days) {
        for (const p of periods) {
          const ts = timeslotMap[day] && timeslotMap[day][p];
          if (!ts) continue;
          const tsId = ts._id.toString();

          const classHas = timetableMatrix[classId][day][p - 1] !== null;
          const facultyBooked =
            facultyTimeslotSets[fid] && facultyTimeslotSets[fid].has(tsId);
          const facultyAvailable =
            availabilityMap[fid] && availabilityMap[fid].has(tsId);

          if (!classHas && !facultyBooked && facultyAvailable) {
            count++;
          }
        }
      }
      possibleSlotCounts[key] = count;
      console.log(
        `  ${a.courseId.courseName} (${a.classId.section}, ${a.facultyId.name}): ${count} possible slots`
      );
    }

    // ---------- Sort assignments ----------
    console.log("\n[STEP 13] Sorting assignments by difficulty...");
    validAssignments.sort((a, b) => {
      const aKey = `${a.classId._id.toString()}-${a.courseId._id.toString()}`;
      const bKey = `${b.classId._id.toString()}-${b.courseId._id.toString()}`;
      const aLab = a.courseId.isLab ? 0 : 1;
      const bLab = b.courseId.isLab ? 0 : 1;
      if (aLab !== bLab) return aLab - bLab;
      return possibleSlotCounts[aKey] - possibleSlotCounts[bKey];
    });
    console.log("Sorted assignment order:");
    validAssignments.forEach((a, idx) => {
      const key = `${a.classId._id.toString()}-${a.courseId._id.toString()}`;
      console.log(
        `  ${idx + 1}. ${a.courseId.courseName} (${a.classId.section}) - ${possibleSlotCounts[key]} slots, Lab: ${a.courseId.isLab}`
      );
    });

    // ---------- Progress helpers ----------
    const totalSlots = validAssignments.reduce(
      (sum, a) => sum + a.courseId.credits,
      0
    );
    let slotsAssigned = 0;
    let progressEmitCounter = 0;
    const maybeEmitProgress = (msg) => {
      progressEmitCounter++;
      if (progressEmitCounter % 3 === 0 || Math.random() < 0.05) {
        sendProgress(
          yearSemesterId,
          msg,
          Math.round((slotsAssigned / totalSlots) * 100)
        );
      }
    };

    // ---------- Helper: canPlace ----------
    const canPlaceAt = (classId, day, period, facultyId) => {
      const ts = timeslotMap[day] && timeslotMap[day][period];
      if (!ts) return false;
      const tsId = ts._id.toString();

      if (timetableMatrix[classId][day][period - 1]) return false;
      if (
        facultyTimeslotSets[facultyId] &&
        facultyTimeslotSets[facultyId].has(tsId)
      )
        return false;
      if (!(availabilityMap[facultyId] && availabilityMap[facultyId].has(tsId)))
        return false;

      return true;
    };

    const usedFacultySlots = new Set(); // Track all slots assigned to faculty

    // ---------- Backtracking search ----------
    let backtrackCount = 0;
    const scheduleCourses = (index, depth = 0) => {
      const indent = "  ".repeat(depth);

      if (index >= validAssignments.length) {
        console.log(`${indent}✓ All assignments scheduled successfully!`);
        return [];
      }

      const assignment = validAssignments[index];
      const classId = assignment.classId._id.toString();
      const courseId = assignment.courseId._id.toString();
      const facultyId = assignment.facultyId._id.toString();
      const isLab = !!assignment.courseId.isLab;
      const requiredSlots = assignment.courseId.credits;
      const key = `${classId}-${courseId}`;

      console.log(
        `${indent}[Depth ${depth}] Processing assignment ${index + 1}/${validAssignments.length}: ${assignment.courseId.courseName} for ${assignment.classId.section}`
      );
      console.log(
        `${indent}  Required: ${requiredSlots} slots, Already assigned: ${courseAssignments[key].assigned}`
      );

      if (courseAssignments[key].assigned >= requiredSlots) {
        console.log(`${indent}  ✓ Already satisfied, skipping...`);
        return scheduleCourses(index + 1, depth);
      }

      for (const day of days) {
        if (isLab) {
          for (
            let startIdx = 0;
            startIdx <= periods.length - requiredSlots;
            startIdx++
          ) {
            let blockOk = true;
            const candidateTs = [];

            console.log(
              `${indent}  Trying lab block: ${day}, periods ${periods[startIdx]}-${periods[startIdx + requiredSlots - 1]}`
            );

            for (let offset = 0; offset < requiredSlots; offset++) {
              const period = periods[startIdx + offset];
              const ts = timeslotMap[day] && timeslotMap[day][period];
              if (!ts) {
                blockOk = false;
                break;
              }
              const tsId = ts._id.toString();

              if (timetableMatrix[classId][day][period - 1]) {
                console.log(
                  `${indent}    ✗ Class already has slot at period ${period}`
                );
                blockOk = false;
                break;
              }
              if (
                facultyTimeslotSets[facultyId] &&
                facultyTimeslotSets[facultyId].has(tsId)
              ) {
                console.log(
                  `${indent}    ✗ Faculty already booked at period ${period}`
                );
                blockOk = false;
                break;
              }
              if (
                !(
                  availabilityMap[facultyId] &&
                  availabilityMap[facultyId].has(tsId)
                )
              ) {
                console.log(
                  `${indent}    ✗ Faculty not available at period ${period}`
                );
                blockOk = false;
                break;
              }
              candidateTs.push(ts);
            }

            if (!blockOk) continue;

            console.log(`${indent}    ✓ Block available, placing...`);
            const createdEntries = [];
            for (const ts of candidateTs) {
              timetableMatrix[classId][day][ts.period - 1] = {
                courseId,
                facultyId,
                timeslotId: ts._id,
              };
              facultyTimeslotSets[facultyId].add(ts._id.toString());
              usedFacultySlots.add(`${facultyId}::${ts._id}`);
              courseAssignments[key].assigned++;
              slotsAssigned++;
              createdEntries.push({
                classId,
                courseId,
                facultyId,
                timeslotId: ts._id,
                room: `Room-${classId}-${ts._id}`,
              });
              maybeEmitProgress(
                `Assigned ${assignment.courseId.courseName} for ${assignment.classId.section}`
              );
            }
            console.log(
              `${indent}    Progress: ${courseAssignments[key].assigned}/${requiredSlots} assigned`
            );

            const downstream = scheduleCourses(index + 1, depth + 1);
            if (downstream) {
              return createdEntries.concat(downstream);
            }

            backtrackCount++;
            console.log(
              `${indent}    ✗ Backtracking (count: ${backtrackCount})...`
            );
            for (const ts of candidateTs) {
              timetableMatrix[classId][day][ts.period - 1] = null;
              facultyTimeslotSets[facultyId].delete(ts._id.toString());
              courseAssignments[key].assigned--;
              slotsAssigned--;
            }
          }
        } else {
          for (const period of periods) {
            if (!canPlaceAt(classId, day, period, facultyId)) {
              continue;
            }

            const ts = timeslotMap[day][period];
            console.log(`${indent}  Trying: ${day}, period ${period}`);

            timetableMatrix[classId][day][period - 1] = {
              courseId,
              facultyId,
              timeslotId: ts._id,
            };
            facultyTimeslotSets[facultyId].add(ts._id.toString());
            usedFacultySlots.add(`${facultyId}::${ts._id}`);
            courseAssignments[key].assigned++;
            slotsAssigned++;
            console.log(
              `${indent}    ✓ Placed. Progress: ${courseAssignments[key].assigned}/${requiredSlots}`
            );

            maybeEmitProgress(
              `Assigned ${assignment.courseId.courseName} for ${assignment.classId.section}`
            );

            const createdEntry = {
              classId,
              courseId,
              facultyId,
              timeslotId: ts._id,
              room: `Room-${classId}-${ts._id}`,
            };

            const nextIndex =
              courseAssignments[key].assigned >= requiredSlots
                ? index + 1
                : index;
            const downstream = scheduleCourses(nextIndex, depth + 1);
            if (downstream) {
              return [createdEntry].concat(downstream);
            }

            backtrackCount++;
            console.log(
              `${indent}    ✗ Backtracking (count: ${backtrackCount})...`
            );
            timetableMatrix[classId][day][period - 1] = null;
            facultyTimeslotSets[facultyId].delete(ts._id.toString());
            courseAssignments[key].assigned--;
            slotsAssigned--;
          }
        }
      }

      console.log(`${indent}✗ No valid placement found for this assignment`);
      return null;
    };

    // ---------- Run scheduler ----------
    console.log("\n[STEP 14] Starting backtracking scheduler...");
    sendProgress(yearSemesterId, "Started generating timetable", 0);
    const timetableEntries = scheduleCourses(0);

    console.log(`\nScheduler completed. Total backtracks: ${backtrackCount}`);

    if (!timetableEntries || timetableEntries.length === 0) {
      console.log("\n✗ SCHEDULING FAILED - Generating diagnostics...");

      const suggestions = [];

      const classCreditMap = {};
      validAssignments.forEach((a) => {
        const classId = a.classId._id.toString();
        classCreditMap[classId] =
          (classCreditMap[classId] || 0) + a.courseId.credits;
      });
      Object.entries(classCreditMap).forEach(([classId, credits]) => {
        if (credits > 36) {
          const section =
            classes.find((c) => c._id.toString() === classId)?.section ||
            classId;
          suggestions.push(
            `Reduce courses for class ${section} (current credits: ${credits})`
          );
        }
      });

      const facultyLoad = {};
      validAssignments.forEach((a) => {
        const facultyId = a.facultyId._id.toString();
        facultyLoad[facultyId] =
          (facultyLoad[facultyId] || 0) + a.courseId.credits;
      });
      const availableSlots = {};
      Object.entries(availabilityMap).forEach(([fid, set]) => {
        availableSlots[fid] = set.size;
      });
      Object.entries(facultyLoad).forEach(([fid, need]) => {
        if ((availableSlots[fid] || 0) < need) {
          const fac = validAssignments.find(
            (v) => v.facultyId._id.toString() === fid
          )?.facultyId;
          suggestions.push(
            `Increase availability for faculty ${fac?.name || fid}`
          );
        }
      });

      console.log("Suggestions:", suggestions);
      sendProgress(yearSemesterId, "Timetable generation failed", 0);
      throw new ApiError(
        400,
        "Failed to generate timetable due to conflicts",
        suggestions
      );
    }

    console.log(
      `\n✓ SUCCESS - Generated ${timetableEntries.length} timetable entries`
    );

    // ---------- Persist results ----------
    console.log("\n[STEP 15] Persisting timetable to database...");
    await Timetable.deleteMany(
      { classId: { $in: classes.map((c) => c._id) } },
      { session }
    );
    await Timetable.insertMany(timetableEntries, { session });
    console.log("✓ Timetable saved successfully");

    // ---------- Update faculty availability ----------
    const updates = Array.from(usedFacultySlots).map((pair) => {
      console.log(pair);
      const [facultyId, timeslotId] = pair.split("::");
      return {
        updateOne: {
          filter: { facultyId, timeslotId },
          update: { $set: { isAvailable: false } },
        },
      };
    });

    if (updates.length > 0) {
      const result = await FacultyAvailability.bulkWrite(updates, { session });
      console.log("result", result);
      console.log(`✓ Updated ${updates.length} faculty availability records`);
    }

    await session.commitTransaction();
    sendProgress(yearSemesterId, "Timetable generated successfully", 100);

    console.log("\n========== TIMETABLE GENERATION COMPLETED ==========\n");

    return res
      .status(202)
      .json(new ApiResponse(202, null, "Timetable generated successfully"));
  } catch (error) {
    console.error("\n✗ ERROR OCCURRED:", error.message);
    console.error("Stack:", error.stack);
    await session.abortTransaction();
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Unknown error",
      error.errors || []
    );
  } finally {
    await session.endSession();
  }
});