import { Router } from "express";
import {
  createTimeSlot,
  getTimeSlots,
} from "../controllers/timeslot.controllers.js";

const router = Router();

router.route("/").post(createTimeSlot);
router.route("/").get(getTimeSlots);

export const timeslotRoutes = router;
