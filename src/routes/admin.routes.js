import { Router } from "express";
import { createFaculty } from "../controllers/admin.controllers.js";
import { validateCreateFaculty } from "../middlewares/validators.js";

const router = Router();

router.route("/faculty").post(validateCreateFaculty, createFaculty);

export const adminRoutes = router;
