import { Router } from "express";
import {
  createCourse,
  deleteCourse,
  editCourse,
  getCourse,
} from "../controllers/course.controllers.js";
import {
  validateCreateCourse,
  validateDelete,
  validateEditCourse,
} from "../middlewares/validators.js";

const router = Router();

router.route("/").get(getCourse);
router.route("/").post(validateCreateCourse, createCourse);
router.route("/").put(validateEditCourse, editCourse);
router.route("/:id").delete(validateDelete, deleteCourse);

export const courseRoutes = router;
