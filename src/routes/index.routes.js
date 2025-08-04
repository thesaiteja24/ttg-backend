import { Router } from "express";
import { healthCheckRoutes } from "./healthcheck.routes.js";
import { userRoutes } from "./user.routes.js";

const router = Router();

router.use("/health", healthCheckRoutes);
router.use("/user", userRoutes);

export const indexRoutes = router;
