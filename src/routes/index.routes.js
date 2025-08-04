import { Router } from "express";
import { healthCheckRoutes } from "./healthcheck.routes.js";
import { userRoutes } from "./user.routes.js";
import { facultyRoutes } from "./faculty.routes.js";
import { courseRoutes } from "./course.routes.js";

const router = Router();

router.use("/health", healthCheckRoutes);
router.use("/user", userRoutes);
router.use("/faculty", facultyRoutes);
router.use("/course", courseRoutes);

export const indexRoutes = router;
