import { body, param } from "express-validator";

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
  body("id").notEmpty().withMessage("Faculty id is required"),
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

export const validateCreateCourse = [
  body("yearSemesterId")
    .isString()
    .withMessage("year semester ID must be a string")
    .notEmpty()
    .withMessage("year semester ID must be a string"),
  body("courseId")
    .isString()
    .withMessage("Course ID must be a string")
    .trim()
    .notEmpty()
    .withMessage("Course ID cannot be empty"),
  body("courseName")
    .isString()
    .withMessage("Course name must be a string")
    .trim()
    .notEmpty()
    .withMessage("Course name cannot be empty"),
  body("courseShortName")
    .isString()
    .withMessage("Short name must be a string")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Short name must be at least 2 characters"),
  body("credits")
    .isNumeric()
    .withMessage("Credits must be numeric")
    .isInt({ min: 0, max: 3 })
    .withMessage("Credits must be between 0 and 3"),
  body("isLab").isBoolean().withMessage("isLab must be a boolean value"),
];

export const validateEditCourse = [
  body("id")
    .notEmpty()
    .withMessage("Course id is required")
    .isString()
    .withMessage("Course id must be a string"),
  body("courseId")
    .isString()
    .withMessage("CourseID must be a string")
    .trim()
    .notEmpty()
    .withMessage("CourseID cannot be empty"),
  body("courseName")
    .isString()
    .withMessage("Course name must be a string")
    .trim()
    .notEmpty()
    .withMessage("Course name cannot be empty"),
  body("courseShortName")
    .isString()
    .withMessage("Short name must be a string")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Short name must be at least 2 characters"),
  body("credits")
    .isNumeric()
    .withMessage("Credits must be numeric")
    .isInt({ min: 0, max: 3 })
    .withMessage("Credits must be between 0 and 3"),
  body("isLab").isBoolean().withMessage("isLab must be a boolean value"),
];

export const validateDelete = [
  param("id")
    .notEmpty()
    .withMessage("id is required")
    .isString()
    .withMessage("id must be a string"),
];

export const validateCreateYearSemester = [
  body("year")
    .trim()
    .isInt({ min: 1, max: 4 })
    .withMessage("Year must be between 1 and 4"),
  body("semester")
    .trim()
    .isInt({ min: 1, max: 2 })
    .withMessage("Semester must be 1 or 2"),
  body("branch")
    .trim()
    .customSanitizer((value) => value.toUpperCase())
    .matches(/^[A-Z-]+$/) // 👈 Only uppercase letters and hyphen
    .withMessage(
      "Branch must contain only uppercase letters (A–Z) and hyphens (-)"
    ),
  body("sections")
    .trim()
    .isArray({ min: 1 })
    .withMessage("Sections must be a non-empty array"),
];

export const validateEditYearSemester = [
  body("id")
    .trim()
    .notEmpty()
    .withMessage("YearSemester id is required")
    .isString()
    .withMessage("YearSemester id must be a string"),
  body("year")
    .trim()
    .isInt({ min: 1, max: 4 })
    .withMessage("Year must be between 1 and 4"),
  body("semester")
    .trim()
    .isInt({ min: 1, max: 2 })
    .withMessage("Semester must be 1 or 2"),
  body("branch")
    .trim()
    .customSanitizer((value) => value.toUpperCase())
    .matches(/^[A-Z-]+$/) // 👈 Only uppercase letters and hyphen
    .withMessage(
      "Branch must contain only uppercase letters (A–Z) and hyphens (-)"
    ),
  body("sections")
    .trim()
    .isArray({ min: 1 })
    .withMessage("Sections must be a non-empty array"),
];

// Assignment Validators
export const validateCreateAssignment = [
  body("courseId")
    .notEmpty()
    .withMessage("courseId is required")
    .isUUID()
    .withMessage("Invalid courseId"),
  body("facultyId")
    .notEmpty()
    .withMessage("facultyId is required")
    .isUUID()
    .withMessage("Invalid facultyId"),

  body("classId")
    .notEmpty()
    .withMessage("classId is required")
    .isUUID()
    .withMessage("Invalid classId"),
];
