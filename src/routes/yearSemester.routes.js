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

router.route("/").get(getYearSemesters);
router.route("/classes").get(getClasses);
router.route("/").post(validateCreateYearSemester, createYearSemester);
router.route("/").put(validateEditYearSemester, editYearSemester);
router.route("/:id").delete(validateDelete, deleteYearSemester);

export const yearSemesterRoutes = router;
