import { Router } from "express";
import {
  createYearSemester,
  deleteYearSemester,
  editYearSemester,
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
router.route("/").delete(validateDelete, deleteYearSemester);
router.route("/").get(getYearSemesters);

export const yearSemesterRoutes = router;
