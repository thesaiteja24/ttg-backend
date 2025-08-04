import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validationResult } from "express-validator";
import { User } from "../models/user.model.js";

export const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "Cannot find user");
    }

    const accessToken = user.generateRefreshToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Somenthing went wrong while generating access and refresh tokens"
    );
  }
};

export const registerUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation failed",
      errors.array().map((err) => err.msg)
    );
  }
  const { name, email, password, countryCode, phone, role } = req.body;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(409, "Email Id already exists, Please login");
  }

  const user = await User.create({
    name,
    email,
    password,
    countryCode,
    phone,
    role,
  });

  const newUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!newUser) {
    throw new ApiError(500, "Somenthing went wrong while creating the user");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        201,
        { user: newUser, accessToken, refreshToken },
        "User registered successfully"
      )
    );
});

export const loginUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new ApiError(
      400,
      "Validation failed",
      errors.array().map((err) => err.msg)
    );
  }

  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "No user with that email found, please register");
  }

  const isPasswordValid = await user.validatePassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid password");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedIdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!loggedIdUser) {
    throw new ApiError(500, "Somenthing went wrong while registering the user");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: loggedIdUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});
