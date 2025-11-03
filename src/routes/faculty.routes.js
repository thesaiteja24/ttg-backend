import { Router } from "express";
import {
  createFaculty,
  deleteFaculty,
  editFaculty,
  facultyAvailability,
  getFaculty,
} from "../controllers/faculty.controllers.js";
import {
  validateCreateFaculty,
  validateDelete,
  validateEditFaculty,
} from "../middlewares/validators.js";

const router = Router();

router.route("/").get(getFaculty);
router.route("/").post(validateCreateFaculty, createFaculty);
router.route("/").put(validateEditFaculty, editFaculty);
router.route("/:id").delete(validateDelete, deleteFaculty);
router.route("/:id/schedule").get(facultyAvailability);

export const facultyRoutes = router;
