const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/product/:productId", reviewController.getProductReviews);
router.get("/my-opportunities", authMiddleware, reviewController.getMyReviewOpportunities);
router.post("/", authMiddleware, reviewController.createReview);

module.exports = router;
