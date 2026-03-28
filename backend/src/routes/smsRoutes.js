const express = require("express");
const router = express.Router();
const smsController = require("../controllers/smsController");

// Публичные маршруты для SMS-верификации
router.post("/send-code", smsController.sendCode);
router.post("/verify-code", smsController.verifyCode);

module.exports = router;
