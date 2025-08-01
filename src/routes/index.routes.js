import { Router } from "express";
import { healthCheckRoutes } from "./healthcheck.routes.js";

const router = Router();

// mount sub-routers
router.use("/health", healthCheckRoutes);

// you can add more here, e.g.:
// router.use("/users", usersRouter);
// router.use("/courses", coursesRouter);

export const  indexRoutes = router;
