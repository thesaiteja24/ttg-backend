import { Router } from "express";
import { generateTimetable } from "../controllers/timetable.controllers.js";
import { validateCreateTimetable } from "../middlewares/validators.js";
const router = Router();

router.route("/").post(validateCreateTimetable, generateTimetable);

export const timetableRoutes = router;
