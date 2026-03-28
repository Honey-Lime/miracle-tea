const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// Public route: register or login
router.post("/login", authController.registerOrLogin);

// Protected route: get profile
router.get("/profile", authMiddleware, authController.getProfile);

// Protected route: change password
router.put("/change-password", authMiddleware, authController.changePassword);

// Forgot password - отправка кода подтверждения
router.post("/forgot-password", authController.forgotPassword);

// Reset password - установка нового пароля после проверки кода
router.post("/reset-password", authController.resetPassword);

module.exports = router;
