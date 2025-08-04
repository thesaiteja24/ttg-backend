import { Router } from "express";
import {
  createCourse,
  createFaculty,
  editCourse,
  editFaculty,
} from "../controllers/admin.controllers.js";
import {
  validateCreateCourse,
  validateCreateFaculty,
  validateEditCourse,
  validateEditFaculty,
} from "../middlewares/validators.js";

const router = Router();

// Faculty operatoins
router.route("/faculty").post(validateCreateFaculty, createFaculty);
router.route("/faculty").put(validateEditFaculty, editFaculty);

// Course operations
router.route("/course").post(validateCreateCourse, createCourse);
router.route("/course").put(validateEditCourse, editCourse);

export const adminRoutes = router;
