import { Router } from "express";
import {
  createCourse,
  editCourse,
  getCourse,
} from "../controllers/course.controllers.js";
import {
  validateCreateCourse,
  validateEditCourse,
} from "../middlewares/validators.js";

const router = Router();

router.route("/").post(validateCreateCourse, createCourse);
router.route("/").put(validateEditCourse, editCourse);
router.route("/").get(getCourse);

export const courseRoutes = router;
