import { Router } from "express";
import {
  generateTimetable,
  getTimeTable,
} from "../controllers/timetable.controllers.js";
import { validateCreateTimetable } from "../middlewares/validators.js";
const router = Router();

router.route("/").post(generateTimetable);
router.route("/:yearSemesterId").get(getTimeTable);

export const timetableRoutes = router;
