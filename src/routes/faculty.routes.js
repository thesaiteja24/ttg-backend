import { Router } from "express";
import {
  createFaculty,
  deleteFaculty,
  editFaculty,
  getFaculty,
} from "../controllers/faculty.controlers.js";
import {
  validateCreateFaculty,
  validateEditFaculty,
} from "../middlewares/validators.js";

const router = Router();

router.route("/").post(validateCreateFaculty, createFaculty);
router.route("/").put(validateEditFaculty, editFaculty);
router.route("/").get(getFaculty);
router.route("/:id").delete(deleteFaculty);

export const facultyRoutes = router;
