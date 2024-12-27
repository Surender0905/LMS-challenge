import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";
import { deleteMediaFromCloudinary, uploadMedia } from "../utils/cloudinary.js";
import { catchAsync } from "../middleware/error.middleware.js";
import { AppError } from "../middleware/error.middleware.js";
import crypto from "crypto";
import { log } from "console";

/**
 * Create a new user account
 * @route POST /api/v1/users/signup
 */
export const createUserAccount = catchAsync(async (req, res) => {
    // TODO: Implement create user account functionality
    const { name, email, password, role = "student" } = req.body;
    //check user exists
    const user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
        throw new AppError("User already exists", 409);
    }

    const newUser = await User.create({
        name,
        email: email.toLowerCase(),
        password,
        role,
    });

    //my mistake--> not to mention = update last active
    await newUser.updateLastActive();

    // Generate token
    generateToken(res, newUser, "User created successfully");
});

/**
 * Authenticate user and get token
 * @route POST /api/v1/users/signin
 */
export const authenticateUser = catchAsync(async (req, res) => {
    // TODO: Implement user authentication functionality

    const { email, password } = req.body;

    //check user exists
    const user = await User.findOne({ email: email.toLowerCase() }).select(
        "+password",
    );

    if (!user) {
        throw new AppError("User not found", 404);
    }

    //check password
    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
        throw new AppError("Invalid credentials", 401);
    }

    ///update last active
    await user.updateLastActive();

    // Generate token
    generateToken(res, user, "User signed in successfully");
});

/**
 * Sign out user and clear cookie
 * @route POST /api/v1/users/signout
 */
export const signOutUser = catchAsync(async (_, res) => {
    // TODO: Implement sign out functionality

    return res
        .status(200)
        .clearCookie("token")
        .json({ success: true, message: "User signed out successfully" });
});

/**
 * Get current user profile
 * @route GET /api/v1/users/profile
 */
export const getCurrentUserProfile = catchAsync(async (req, res) => {
    // TODO: Implement get current user profile functionality

    const user = await User.findById(req.id)
        .populate({
            path: "enrolledCourses.course",
            select: "title description thumbnail",
        })
        .populate({
            path: "createdCourses",
            select: "title, thumbnail, enrolledStudents",
        });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    return res.status(200).json({
        success: true,
        data: {
            ...user.toJSON(),
            totalEnrolledCourses: user.totalEnrolledCourses,
        },
    });
});

/**
 * Update user profile
 * @route PATCH /api/v1/users/profile
 */
export const updateUserProfile = catchAsync(async (req, res) => {
    // TODO: Implement update user profile functionality
    const { name, email, bio } = req.body; //name, email, bio

    const updateData = { name, email: email.toLowerCase(), bio };
    //handle avatar upload if present
    if (req.file) {
        const avatarResult = await uploadMedia(req.file.path);
        updateData.avatar = avatarResult;

        ///delete old avatar if present
        const user = await User.findById(req.id);
        if (user.avatar && user.avatar !== "default-avatar.png") {
            await deleteMediaFromCloudinary(req.user.avatar.public_id);
        }
    }

    ///update user profile
    const user = await User.findByIdAndUpdate(req.id, updateData, {
        new: true,
        runValidators: true,
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    return res.status(200).json({
        success: true,
        message: "User profile updated successfully",
        data: user,
    });
});

/**
 * Change user password
 * @route PATCH /api/v1/users/password
 */
export const changeUserPassword = catchAsync(async (req, res) => {
    // TODO: Implement change user password functionality
    const { currentPassword, newPassword } = req.body;
    ///find user
    const user = await User.findById(req.id).select("+password");
    if (!user) {
        throw new AppError("User not found", 404);
    }
    ///check password
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
        throw new AppError("Invalid current password", 401);
    }
    ///update password
    user.password = newPassword;
    await user.save();
    return res.status(200).json({
        success: true,
        message: "Password changed successfully",
    });
});

/**
 * Request password reset
 * @route POST /api/v1/users/forgot-password
 */
export const forgotPassword = catchAsync(async (req, res) => {
    // TODO: Implement forgot password functionality
    const { email } = req.body;

    //check user exists
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    const resetToken = user.getResetPasswordToken();

    await user.save();

    //send email

    return res.status(200).json({
        success: true,
        message: "Password reset token sent to email",
    });
});

/**
 * Reset password
 * @route POST /api/v1/users/reset-password/:token
 */
export const resetPassword = catchAsync(async (req, res) => {
    // TODO: Implement reset password functionality

    const { password } = req.body;
    const { token } = req.params;

    const user = await User.findOne({
        resetPasswordToken: crypto
            .createHash("sha256")
            .update(token)
            .digest("hex"),
        resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
        throw new AppError("User not found", 404);
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    return res.status(200).json({
        success: true,
        message: "Password reset successfully",
    });
});

/**
 * Delete user account
 * @route DELETE /api/v1/users/account
 */
export const deleteUserAccount = catchAsync(async (req, res) => {
    // TODO: Implement delete user account functionality
    const user = await User.findById(req.id);
    // delete avatar if present
    if (user.avatar && user.avatar !== "default-avatar.png") {
        await deleteMediaFromCloudinary(user.avatar);
    }
    await user.remove();
    return res.status(200).json({
        success: true,
        message: "User account deleted successfully",
    });
});
