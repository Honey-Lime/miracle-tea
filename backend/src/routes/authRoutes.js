const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// Public route: register or login
router.post("/login", authController.registerOrLogin);

// Protected route: get profile
router.get("/profile", authMiddleware, authController.getProfile);

module.exports = router;
