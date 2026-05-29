const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middleware/authMiddleware");

// Payment routes
router.post("/init", authMiddleware, orderController.createPayment);

module.exports = router;
