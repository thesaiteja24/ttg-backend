import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

//routes import
import { indexRoutes } from "./routes/index.routes.js";
import { ApiError } from "./utils/apiError.js";
import { globalErrorHandler } from "./middlewares/globalErrorHandler.js";

//routes declaration
app.use("/api/v1", indexRoutes);

// Global error-handling middleware
app.use(globalErrorHandler);

export { app };
