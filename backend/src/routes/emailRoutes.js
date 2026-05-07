const express = require("express");
const router = express.Router();
const emailController = require("../controllers/emailController");

router.post("/send-code", emailController.sendCode);
router.post("/verify-code", emailController.verifyCode);

module.exports = router;
