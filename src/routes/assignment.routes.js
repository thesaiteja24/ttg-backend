import { Router } from "express";
import {
  createAssignment,
  deleteAssignment,
  editAssignment,
  getAssignment,
} from "../controllers/assignement.controllers.js";
import {
  validateCreateAssignment,
  validateDelete,
} from "../middlewares/validators.js";

const router = Router();

router.route("/").get(getAssignment);
router.route("/").post(validateCreateAssignment, createAssignment);
router.route("/:id").put(validateCreateAssignment, editAssignment);
router.route("/:id").delete(validateDelete, deleteAssignment);

export const assignmentRoutes = router;
