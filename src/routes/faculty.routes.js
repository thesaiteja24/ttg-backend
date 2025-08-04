import { Router } from "express";
import {
  createFaculty,
  editFaculty,
} from "../controllers/faculty.controlers.js";
import {
  validateCreateFaculty,
  validateEditFaculty,
} from "../middlewares/validators.js";

const router = Router();

router.route("/").post(validateCreateFaculty, createFaculty);
router.route("/").put(validateEditFaculty, editFaculty);

export const facultyRoutes = router;
