import { Router } from "express";
import {
  createYearSemester,
  deleteYearSemester,
  editYearSemester,
  getClasses,
  getYearSemesters,
} from "../controllers/yearSemester.controllers.js";
import {
  validateCreateYearSemester,
  validateDelete,
  validateEditYearSemester,
} from "../middlewares/validators.js";

const router = Router();

router.route("/").post(validateCreateYearSemester, createYearSemester);
router.route("/").put(validateEditYearSemester, editYearSemester);
router.route("/:id").delete(validateDelete, deleteYearSemester);
router.route("/").get(getYearSemesters);
router.route("/classes").get(getClasses);

export const yearSemesterRoutes = router;
