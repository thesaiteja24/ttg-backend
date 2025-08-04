import { body } from "express-validator";

export const validateRegister = [
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("countryCode")
    .notEmpty()
    .withMessage("Country code is required")
    .isNumeric()
    .withMessage("Country code must be numeric"),
  body("phone")
    .notEmpty()
    .withMessage("Phone number is required")
    .isNumeric()
    .withMessage("Phone number must be numeric"),
  body("role")
    .optional()
    .isIn(["admin", "faculty", "student"])
    .withMessage("Role must be one of: admin, faculty, student"),
];

export const validateLogin = [
  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];

export const validateCreateFaculty = [
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("countryCode")
    .notEmpty()
    .withMessage("Country code is required")
    .isNumeric()
    .withMessage("Country code must be numeric"),
  body("phone")
    .notEmpty()
    .withMessage("Phone number is required")
    .isNumeric()
    .withMessage("Phone number must be numeric")
    .isLength({ min: 10 })
    .withMessage("Phone number must be 10 digits"),
];

export const validateEditFaculty = [
  body("facultyId").notEmpty().withMessage("Faculty Id is required"),
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("countryCode")
    .notEmpty()
    .withMessage("Country code is required")
    .isNumeric()
    .withMessage("Country code must be numeric"),
  body("phone")
    .notEmpty()
    .withMessage("Phone number is required")
    .isNumeric()
    .withMessage("Phone number must be numeric")
    .isLength({ min: 10 })
    .withMessage("Phone number must be 10 digits"),
];
