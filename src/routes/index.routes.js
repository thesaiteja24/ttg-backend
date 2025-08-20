import { Router } from "express";
import { healthCheckRoutes } from "./healthcheck.routes.js";
import { userRoutes } from "./user.routes.js";
import { facultyRoutes } from "./faculty.routes.js";
import { courseRoutes } from "./course.routes.js";
import { yearSemesterRoutes } from "./yearSemester.routes.js";
import { assignmentRoutes } from "./assignment.routes.js";

const router = Router();

router.use("/health", healthCheckRoutes);
router.use("/user", userRoutes);
router.use("/faculty", facultyRoutes);
router.use("/course", courseRoutes);
router.use("/year-semester", yearSemesterRoutes);
router.use("/assignment", assignmentRoutes);

export const indexRoutes = router;
