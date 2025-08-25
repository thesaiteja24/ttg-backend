import { Router } from "express";
import {
  createAssignment,
  getAssignment,
} from "../controllers/assignement.controllers.js";
import { validateCreateAssignment } from "../middlewares/validators.js";

const router = Router();

router.route("/").post(validateCreateAssignment, createAssignment);
router.route("/").get(getAssignment);

export const assignmentRoutes = router;
