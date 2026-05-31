const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const authMiddleware = require("../middleware/authMiddleware");
const reviewUpload = require("../middleware/reviewUploadMiddleware");

const optionalAuthMiddleware = (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return next();
  }

  return authMiddleware(req, res, next);
};

router.get("/product/:productId", optionalAuthMiddleware, reviewController.getProductReviews);
router.get("/my-opportunities", authMiddleware, reviewController.getMyReviewOpportunities);
router.get("/my-summary", authMiddleware, reviewController.getMyReviewsSummary);
router.post("/", authMiddleware, reviewUpload.array("photos", 5), reviewController.createReview);
router.put("/my-admin-comments/seen", authMiddleware, reviewController.markMyReviewAdminCommentsSeen);
router.put("/:id/reaction", authMiddleware, reviewController.reactToReview);

module.exports = router;
