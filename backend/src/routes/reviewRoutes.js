const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const authMiddleware = require("../middleware/authMiddleware");
const reviewUpload = require("../middleware/reviewUploadMiddleware");

router.get("/product/:productId", reviewController.getProductReviews);
router.get("/my-opportunities", authMiddleware, reviewController.getMyReviewOpportunities);
router.post("/", authMiddleware, reviewUpload.array("photos", 5), reviewController.createReview);
router.put("/:id/reaction", authMiddleware, reviewController.reactToReview);

module.exports = router;
