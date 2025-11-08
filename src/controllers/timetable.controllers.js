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
  console.log("\n========== GLOBAL TIMETABLE GENERATION STARTED ==========");
  // Request body validation (if you require any params you can add them—this version acts on all year-semesters)
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation Error",
      errors.array().map((err) => err.msg)
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  req.session = session;

  try {
    // ---------- STEP 1: Fetch global data ----------
    console.log(
      "\n[STEP 1] Fetching global data (courses, classes, assignments, timeslots)..."
    );
    const [courses, classes, timeslots] = await Promise.all([
      Course.find({}, {}, { session }),
      Class.find({}, {}, { session }),
      Timeslot.find({}, {}, { session }).sort({ day: 1, period: 1 }),
    ]);

    if (!classes || classes.length === 0) {
      throw new ApiError(404, "No classes found in the system");
    }
    if (!courses || courses.length === 0) {
      throw new ApiError(404, "No courses found in the system");
    }
    if (!timeslots || timeslots.length === 0) {
      throw new ApiError(404, "No timeslots found in the system");
    }

    console.log(
      `Found ${courses.length} courses, ${classes.length} classes, ${timeslots.length} timeslots`
    );

    // Build timeslot map: timeslotMap[day][period] = timeslotDoc
    const timeslotMap = {};
    timeslots.forEach((t) => {
      if (!timeslotMap[t.day]) timeslotMap[t.day] = {};
      timeslotMap[t.day][t.period] = t;
    });

    // ---------- STEP 2: Build enriched assignments (all year-semesters) ----------
    console.log(
      "\n[STEP 2] Fetching enriched assignments for all year-semesters..."
    );
    // Similar aggregation as before but for all courses; result contains courseDetails, facultyDetails, classDetails
    const aggAssignments = await Assignment.aggregate([
      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "courseDetails",
          pipeline: [
            {
              $project: {
                _id: 1,
                courseName: 1,
                credits: 1,
                isLab: 1,
                yearSemesterId: 1,
              },
            },
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

    if (!aggAssignments || aggAssignments.length === 0) {
      throw new ApiError(
        404,
        "No valid assignments found across year-semesters"
      );
    }

    console.log(
      `Found ${aggAssignments.length} assignments across all year-semesters`
    );
    // Optionally log first few assignments for debugging
    aggAssignments.slice(0, 10).forEach((a, idx) => {
      console.log(
        `  ${idx + 1}. ${a.courseId.courseName} -> ${a.classId.section} (Faculty: ${a.facultyId.name})`
      );
    });

    const validAssignments = aggAssignments;

    // ---------- STEP 3: Extract faculties and classes targeted ----------
    const facultyIds = [
      ...new Set(validAssignments.map((a) => a.facultyId._id.toString())),
    ];
    const targetClassIds = [
      ...new Set(validAssignments.map((a) => a.classId._id.toString())),
    ];

    console.log(
      `\n[STEP 3] Unique faculty IDs: ${facultyIds.length}. Target classes: ${targetClassIds.length}`
    );

    // ---------- STEP 4: Faculty availability (global) ----------
    console.log("\n[STEP 4] Fetching faculty availability (global)...");
    // NOTE: Do NOT reset isAvailable globally here. Resetting should be a separate explicit step if desired.
    await FacultyAvailability.updateMany(
      { facultyId: { $in: facultyIds } },
      { $set: { isAvailable: true } },
      { session }
    );

    const availabilityDocs = await FacultyAvailability.find(
      { facultyId: { $in: facultyIds }, isAvailable: true },
      {},
      { session }
    ).populate("timeslotId", "day period");

    const availabilityMap = {};
    availabilityDocs.forEach((av) => {
      const fid = av.facultyId.toString();
      availabilityMap[fid] = availabilityMap[fid] || new Set();
      if (av.timeslotId && av.timeslotId._id) {
        availabilityMap[fid].add(av.timeslotId._id.toString());
      }
    });
    console.log(
      `Availability records (true) found: ${availabilityDocs.length}`
    );

    // ---------- STEP 5: Existing timetable bookings (global, but exclude classes we're going to regenerate) ----------
    console.log(
      "\n[STEP 5] Fetching existing timetable entries for involved faculties (excluding target classes)..."
    );
    const existingTimetable = await Timetable.find(
      {
        facultyId: { $in: facultyIds },
        classId: { $nin: targetClassIds }, // don't count bookings for classes we will replace (they will be deleted)
      },
      {},
      { session }
    ).populate("timeslotId", "day period");

    const facultyTimeslotSets = {}; // tracks global booked timeslots for each faculty
    facultyIds.forEach((fid) => (facultyTimeslotSets[fid] = new Set()));
    existingTimetable.forEach((entry) => {
      const fid = entry.facultyId.toString();
      if (entry.timeslotId && entry.timeslotId._id) {
        facultyTimeslotSets[fid].add(entry.timeslotId._id.toString());
      }
    });
    console.log(
      `Existing timetable entries considered (excluded target classes): ${existingTimetable.length}`
    );

    // ---------- STEP 6: Per-class credits validation (per-class and optionally per-year-semester) ----------
    console.log(
      "\n[STEP 6] Validating per-class credits (must not exceed 36)..."
    );
    const classCredits = {};
    for (const a of validAssignments) {
      const classId = a.classId._id.toString();
      classCredits[classId] = (classCredits[classId] || 0) + a.courseId.credits;
      if (classCredits[classId] > 36) {
        const section =
          classes.find((c) => c._id.toString() === classId)?.section || classId;
        throw new ApiError(
          400,
          `Class ${section} exceeds 36 credits (total: ${classCredits[classId]})`
        );
      }
    }
    console.log("Per-class credits check passed");

    // Optional: per-year-semester total credits check (if you want similar to earlier per-year validation)
    // you may compute course sums by course.yearSemesterId if desired

    // ---------- STEP 7: Initialize timetable matrices for each class (global) ----------
    console.log(
      "\n[STEP 7] Initializing timetable matrix for each target class..."
    );
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const periods = [1, 2, 3, 4, 5, 6];
    const timetableMatrix = {}; // timetableMatrix[classId][day][periodIndex]
    classes.forEach((cls) => {
      const cid = cls._id.toString();
      // Only initialize for classes we care about (i.e., those in assignments)
      if (!targetClassIds.includes(cid)) return;
      timetableMatrix[cid] = {};
      days.forEach((day) => {
        timetableMatrix[cid][day] = Array(periods.length).fill(null);
      });
    });

    // Track how many times a course appears per day per class
    const classDayCourseCount = {}; // classDayCourseCount[classId][day][courseId] = count

    classes.forEach((cls) => {
      const cid = cls._id.toString();
      if (!targetClassIds.includes(cid)) return;
      classDayCourseCount[cid] = {};
      days.forEach((day) => {
        classDayCourseCount[cid][day] = {};
      });
    });

    // Track how many distinct days each course has been scheduled for (to encourage spread)
    const courseDaySpread = {}; // courseDaySpread[classId][courseId] = Set of days

    classes.forEach((cls) => {
      const cid = cls._id.toString();
      if (!targetClassIds.includes(cid)) return;
      courseDaySpread[cid] = {};
    });

    console.log(
      `Initialized matrices for ${Object.keys(timetableMatrix).length} classes`
    );

    // ---------- STEP 8: Prepare courseAssignments tracking ----------
    console.log(
      "\n[STEP 8] Preparing course assignment trackers (required vs assigned)..."
    );
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
          yearSemesterId: a.courseId.yearSemesterId,
        },
      };
    });

    // ---------- STEP 9: Compute possible slot counts (global) ----------
    console.log("\n[STEP 9] Computing possible slot counts (global)...");
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
      // Optionally log a few examples
    }
    console.log("Possible-slot counts computed");

    // ---------- STEP 10: Sort assignments globally by difficulty ----------
    console.log(
      "\n[STEP 10] Sorting assignments globally (labs then least-flexible first)..."
    );
    validAssignments.sort((a, b) => {
      const aKey = `${a.classId._id.toString()}-${a.courseId._id.toString()}`;
      const bKey = `${b.classId._id.toString()}-${b.courseId._id.toString()}`;
      const aLab = a.courseId.isLab ? 0 : 1; // labs first
      const bLab = b.courseId.isLab ? 0 : 1;
      if (aLab !== bLab) return aLab - bLab;
      // then less possible slots first
      return possibleSlotCounts[aKey] - possibleSlotCounts[bKey];
    });

    // Log sorted top-10 for debugging
    console.log("Sorted assignment order (top 10):");
    validAssignments.slice(0, 10).forEach((a, idx) => {
      const key = `${a.classId._id.toString()}-${a.courseId._id.toString()}`;
      console.log(
        `  ${idx + 1}. ${a.courseId.courseName} (${a.classId.section}) - ${possibleSlotCounts[key]} possible slots, Lab: ${a.courseId.isLab}`
      );
    });

    // ---------- STEP 11: Scheduler (global backtracking) ----------
    console.log("\n[STEP 11] Starting global backtracking scheduler...");
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
          "global",
          msg,
          Math.round((slotsAssigned / totalSlots) * 100)
        );
      }
    };

    // helper: canPlaceAt (now uses global facultyTimeslotSets & availabilityMap & timetableMatrix)
    const canPlaceAt = (
      classId,
      day,
      period,
      facultyId,
      courseId,
      isLab,
      requiredSlots
    ) => {
      const ts = timeslotMap[day] && timeslotMap[day][period];
      if (!ts) return false;
      const tsId = ts._id.toString();

      if (!timetableMatrix[classId]) return false;
      if (timetableMatrix[classId][day][period - 1]) return false;
      if (facultyTimeslotSets[facultyId]?.has(tsId)) return false;
      if (!availabilityMap[facultyId]?.has(tsId)) return false;

      // NEW RULE: non-lab subjects can appear at most 2 times per day
      if (!isLab) {
        const countToday = classDayCourseCount[classId][day][courseId] || 0;
        if (countToday >= 2) return false;

        // Prefer spreading across different days before doubling up
        const daysUsed = courseDaySpread[classId][courseId]?.size || 0;
        const maxSpread = Math.min(requiredSlots, days.length);
        const spreadNotFull = daysUsed < maxSpread;

        // If already placed once today and there are unused days left, skip for now
        if (countToday > 0 && spreadNotFull) return false;
      }

      return true;
    };

    const usedFacultySlots = new Set(); // "facultyId::timeslotId"
    let backtrackCount = 0;

    // scheduleAssignments: index over validAssignments
    const scheduleAssignments = (index, depth = 0) => {
      const indent = "  ".repeat(depth);
      if (index >= validAssignments.length) {
        console.log(
          `${indent}✓ All global assignments scheduled successfully!`
        );
        return [];
      }

      const assignment = validAssignments[index];
      const classId = assignment.classId._id.toString();
      const courseId = assignment.courseId._id.toString();
      const facultyId = assignment.facultyId._id.toString();
      const isLab = !!assignment.courseId.isLab;
      const requiredSlots = assignment.courseId.credits;
      const key = `${classId}-${courseId}`;

      if (!courseAssignments[key]) {
        // should not happen, but guard
        console.log(
          `${indent}  ✗ Unexpected: courseAssignments missing for ${key}`
        );
        return null;
      }

      console.log(
        `${indent}[Depth ${depth}] Assignment ${index + 1}/${validAssignments.length}: ${assignment.courseId.courseName} for ${assignment.classId.section}`
      );
      console.log(
        `${indent}  Required: ${requiredSlots}, Assigned so far: ${courseAssignments[key].assigned}`
      );

      // Already satisfied?
      if (courseAssignments[key].assigned >= requiredSlots) {
        return scheduleAssignments(index + 1, depth); // move on
      }

      // Try placements
      for (const day of days) {
        if (isLab) {
          // place contiguous block of 'requiredSlots' length
          for (
            let startIdx = 0;
            startIdx <= periods.length - requiredSlots;
            startIdx++
          ) {
            let blockOk = true;
            const candidateTs = [];

            for (let offset = 0; offset < requiredSlots; offset++) {
              const period = periods[startIdx + offset];
              const ts = timeslotMap[day] && timeslotMap[day][period];
              if (!ts) {
                blockOk = false;
                break;
              }
              const tsId = ts._id.toString();

              if (
                !timetableMatrix[classId] ||
                timetableMatrix[classId][day][period - 1]
              ) {
                blockOk = false;
                break;
              }
              if (
                facultyTimeslotSets[facultyId] &&
                facultyTimeslotSets[facultyId].has(tsId)
              ) {
                blockOk = false;
                break;
              }
              if (
                !(
                  availabilityMap[facultyId] &&
                  availabilityMap[facultyId].has(tsId)
                )
              ) {
                blockOk = false;
                break;
              }
              candidateTs.push(ts);
            }

            if (!blockOk) continue;

            // Place the block
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

            const downstream = scheduleAssignments(index + 1, depth + 1);
            if (downstream) return createdEntries.concat(downstream);

            // backtrack block
            backtrackCount++;
            for (const ts of candidateTs) {
              timetableMatrix[classId][day][ts.period - 1] = null;
              facultyTimeslotSets[facultyId].delete(ts._id.toString());
              courseAssignments[key].assigned--;
              slotsAssigned--;
            }
          }
        } else {
          for (const period of periods) {
            if (
              !canPlaceAt(
                classId,
                day,
                period,
                facultyId,
                courseId,
                isLab,
                requiredSlots
              )
            ) {
              continue;
            }

            const ts = timeslotMap[day][period];
            // Place single slot
            timetableMatrix[classId][day][period - 1] = {
              courseId,
              facultyId,
              timeslotId: ts._id,
            };
            facultyTimeslotSets[facultyId].add(ts._id.toString());
            usedFacultySlots.add(`${facultyId}::${ts._id}`);
            courseAssignments[key].assigned++;
            slotsAssigned++;
            classDayCourseCount[classId][day][courseId] =
              (classDayCourseCount[classId][day][courseId] || 0) + 1;

            if (!courseDaySpread[classId][courseId])
              courseDaySpread[classId][courseId] = new Set();
            courseDaySpread[classId][courseId].add(day);

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
            const downstream = scheduleAssignments(nextIndex, depth + 1);
            if (downstream) {
              return [createdEntry].concat(downstream);
            }

            // backtrack single slot
            backtrackCount++;
            timetableMatrix[classId][day][period - 1] = null;
            facultyTimeslotSets[facultyId].delete(ts._id.toString());
            courseAssignments[key].assigned--;
            slotsAssigned--;
            classDayCourseCount[classId][day][courseId]--;
            if (classDayCourseCount[classId][day][courseId] <= 0) {
              courseDaySpread[classId][courseId].delete(day);
            }
          }
        }
      }

      // no placement found for this assignment
      console.log(
        `${indent}✗ No valid placement found for assignment ${assignment.courseId.courseName} (${assignment.classId.section})`
      );
      return null;
    };

    // ---------- STEP 12: Run scheduler ----------
    sendProgress("global", "Started generating timetable (global)", 0);
    const timetableEntries = scheduleAssignments(0);
    console.log(`\nScheduler completed. Total backtracks: ${backtrackCount}`);

    if (!timetableEntries || timetableEntries.length === 0) {
      console.log("\n✗ SCHEDULING FAILED - producing diagnostics...");
      // produce suggestions
      const suggestions = [];

      // per-class credits (already validated)
      // faculty load vs availability
      const facultyLoad = {};
      validAssignments.forEach((a) => {
        const fid = a.facultyId._id.toString();
        facultyLoad[fid] = (facultyLoad[fid] || 0) + a.courseId.credits;
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
            `Increase availability for faculty ${fac?.name || fid} (needs ${need}, available ${availableSlots[fid] || 0})`
          );
        }
      });

      // fallback: suggest reducing courses for overloaded classes
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

      sendProgress("global", "Timetable generation failed", 0);
      throw new ApiError(
        400,
        "Failed to generate global timetable due to conflicts",
        suggestions
      );
    }

    console.log(
      `\n✓ SUCCESS - Generated ${timetableEntries.length} timetable entries (global)`
    );

    // ---------- STEP 13: Persist results ----------
    console.log("\n[STEP 13] Persisting timetable results (in transaction)...");
    // Delete timetables for classes we are regenerating
    await Timetable.deleteMany(
      { classId: { $in: targetClassIds } },
      { session }
    );
    // Insert all created timetable entries
    await Timetable.insertMany(timetableEntries, { session });
    console.log("✓ Timetable entries saved");

    // ---------- STEP 14: Update faculty availability records for used slots ----------
    console.log("\n[STEP 14] Updating faculty availability for used slots...");
    const updates = Array.from(usedFacultySlots).map((pair) => {
      const [facultyId, timeslotId] = pair.split("::");
      return {
        updateOne: {
          filter: { facultyId, timeslotId },
          update: { $set: { isAvailable: false } },
          upsert: false, // assume availability docs exist; if not, you may wish to upsert
        },
      };
    });

    if (updates.length > 0) {
      // bulkWrite may throw if many updates; handle gracefully
      const result = await FacultyAvailability.bulkWrite(updates, { session });
      console.log(
        "FacultyAvailability bulkWrite result:",
        result.result || result
      );
      console.log(
        `✓ Updated ${updates.length} faculty availability records (set to false)`
      );
    } else {
      console.log("No faculty availability updates required");
    }

    // commit
    await session.commitTransaction();
    sendProgress("global", "Timetable generated successfully (global)", 100);
    console.log(
      "\n========== GLOBAL TIMETABLE GENERATION COMPLETED ==========\n"
    );

    return res
      .status(202)
      .json(
        new ApiResponse(202, null, "Global timetable generated successfully")
      );
  } catch (error) {
    console.error("\n✗ ERROR OCCURRED (global scheduler):", error.message);
    console.error("Stack:", error.stack);
    await session.abortTransaction();
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Unknown error",
      error.errors || []
    );
  } finally {
    req.session = null;
    await session.endSession();
  }
});

export const getTimeTable = asyncHandler(async (req, res) => {
  const { yearSemesterId } = req.params;

  const classes = await Class.find({ yearSemesterId });
  if (!classes || classes.length === 0) {
    throw new ApiError(404, "No classes found for the given yearSemesterId");
  }
  const classIds = classes.map((c) => c._id);

  const timetableEntries = await Timetable.find({ classId: { $in: classIds } })
    .populate("classId", "section")
    .populate("courseId", "courseName credits isLab")
    .populate("facultyId", "name")
    .populate("timeslotId", "day period");

  // ---------- Transform timetableEntries into per-class matrix ----------
  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const periods = [1, 2, 3, 4, 5, 6];

  // Initialize structure like: { A1: [ [null,null,...], [null,null,...], ... ] }
  const classMatrices = {};

  for (const entry of timetableEntries) {
    const section = entry.classId.section;
    if (!classMatrices[section]) {
      classMatrices[section] = Array.from({ length: periods.length }, () =>
        Array(days.length).fill(null)
      );
    }

    const dayIndex = days.indexOf(entry.timeslotId.day);
    const periodIndex = entry.timeslotId.period - 1;

    classMatrices[section][periodIndex][dayIndex] = {
      courseName: entry.courseId.courseName,
      facultyName: entry.facultyId.name,
      room: entry.room,
      isLab: entry.courseId.isLab,
    };
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, classMatrices, "Timetable fetched successfully")
    );
});
