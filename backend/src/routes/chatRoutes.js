const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/chatUploadMiddleware");

router.use(authMiddleware);

router.get("/my", chatController.getMyChat);
router.post("/my/messages", upload.array("photos", 5), chatController.sendMyMessage);

module.exports = router;
