import { ApiError } from "../utils/apiError.js";

export const globalErrorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: err.success,
      message: err.message,
      errors: err.errors,
      data: err.data,
    });
  } else {
    console.error("Unhandled error:", err.stack);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      errors: [err.message],
      data: null,
    });
  }
};
