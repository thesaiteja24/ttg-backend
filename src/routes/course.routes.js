import { Router } from "express";
import { createCourse, editCourse } from "../controllers/course.controllers.js";
import {
  validateCreateCourse,
  validateEditCourse,
} from "../middlewares/validators.js";

const router = Router();

router.route("/").post(validateCreateCourse, createCourse);
router.route("/").put(validateEditCourse, editCourse);

export const courseRoutes = router;
