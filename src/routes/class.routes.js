import { Router } from "express";
import {
  validateCreateClass,
  validateDelete,
  validateEditClass,
} from "../middlewares/validators.js";
import {
  createClass,
  deleteClass,
  editClass,
  getClasses,
} from "../controllers/class.controllers.js";

const router = Router();

router.route("/").post(validateCreateClass, createClass);
router.route("/").put(validateEditClass, editClass);
router.route("/").delete(validateDelete, deleteClass);
router.route("/").get(getClasses)

export const classRoutes = router;
