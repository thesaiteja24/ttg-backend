import { Router } from "express";
import {
  createFaculty,
  editFaculty,
} from "../controllers/admin.controllers.js";
import {
  validateCreateFaculty,
  validateEditFaculty,
} from "../middlewares/validators.js";

const router = Router();

router.route("/faculty").post(validateCreateFaculty, createFaculty);
router.route("/faculty").put(validateEditFaculty, editFaculty);

export const adminRoutes = router;
