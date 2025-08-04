import { Router } from "express";
import { loginUser, registerUser } from "../controllers/user.controllers.js";
import { validateLogin, validateRegister } from "../middlewares/validators.js";

const router = Router();

router.route("/register").post(validateRegister, registerUser);
router.route("/login").post(validateLogin, loginUser);

export const userRoutes = router;
