import { Router } from "express";
import {
  createFaculty,
  deleteFaculty,
  editFaculty,
  getFaculty,
} from "../controllers/faculty.controlers.js";
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

export const facultyRoutes = router;
