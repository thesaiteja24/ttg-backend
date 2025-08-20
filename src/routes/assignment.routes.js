import { Router } from "express";
import { createAssignment } from "../controllers/assignement.controllers.js";
import { validateCreateAssignment } from "../middlewares/validators.js";

const router = Router();

router.route("/").post(validateCreateAssignment, createAssignment);

export const assignmentRoutes = router;
