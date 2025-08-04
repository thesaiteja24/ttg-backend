import { Router } from "express";
import { healthCheckRoutes } from "./healthcheck.routes.js";
import { userRoutes } from "./user.routes.js";
import { adminRoutes } from "./admin.routes.js";

const router = Router();

router.use("/health", healthCheckRoutes);
router.use("/user", userRoutes);
router.use("/admin", adminRoutes);

export const indexRoutes = router;
