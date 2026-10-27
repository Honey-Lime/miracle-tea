const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const upload = require("../middleware/uploadMiddleware");
const chatUpload = require("../middleware/chatUploadMiddleware");
const chatController = require("../controllers/chatController");
const marketingController = require("../controllers/marketingController");

// All admin routes require authentication and admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

// Orders
router.get("/orders", adminController.getAllOrders);
router.put("/orders/:id/cancel", adminController.cancelOrder);
router.put("/orders/:id/status", adminController.updateOrderStatus);

// Customers
router.get("/customers", adminController.getCustomers);
router.get("/customers/:id", adminController.getCustomerDetails);
router.put("/customers/:id/bonuses", adminController.adjustCustomerBonuses);

// Products
router.get("/products", adminController.getAllProducts);
router.post("/products", adminController.addProduct);
router.get("/products/search", adminController.searchProducts);
router.put("/products/stock", adminController.addStock);

// Tags (must be before /products/:id to avoid route conflict)
router.get("/products/tags", adminController.getAllTags);
router.post("/products/tags", adminController.createTag);
router.delete("/products/tags", adminController.deleteTag);
router.put("/products/add-tag", adminController.addTagToProduct);
router.put("/products/remove-tag", adminController.removeTagFromProduct);

router.put("/products/:id", adminController.updateProduct);
router.delete("/products/:id", adminController.deleteProduct);

// Product media
router.post(
  "/products/upload-media",
  upload.array("media", 10),
  adminController.uploadProductMedia,
);
router.put("/products/:id/reorder-media", adminController.reorderProductImages);
router.put("/products/:id/delete-media", adminController.deleteProductImage);

// Statistics
router.get("/statistics", adminController.getStatistics);

// Settings
router.get("/settings/bonuses", adminController.getBonusSettings);
router.put("/settings/bonuses", adminController.updateBonusSettings);
router.get("/settings/delivery", adminController.getDeliverySettings);
router.put("/settings/delivery", adminController.updateDeliverySettings);
router.get("/settings/popular", adminController.getPopularSettings);
router.put("/settings/popular", adminController.updatePopularSettings);

// Promo codes
router.get("/promocodes", marketingController.getPromoCodes);
router.post("/promocodes", marketingController.createPromoCode);
router.put("/promocodes/:id", marketingController.updatePromoCode);
router.delete("/promocodes/:id", marketingController.deletePromoCode);

// Referral sources
router.get("/referrals", marketingController.getReferralSources);
router.post("/referrals", marketingController.createReferralSource);
router.get("/referrals/:id", marketingController.getReferralSourceDetails);
router.put("/referrals/:id", marketingController.updateReferralSource);
router.delete("/referrals/:id", marketingController.deleteReferralSource);

// Reviews
router.get("/notifications/counts", adminController.getAdminNotificationCounts);
router.get("/reviews/pending", adminController.getPendingReviews);
router.get("/reviews/approved", adminController.getApprovedReviews);
router.put("/reviews/:id/comment", chatUpload.array("photos", 5), adminController.updateReviewAdminComment);
router.put("/reviews/:id/approve", adminController.approveReview);
router.put("/reviews/:id/reject", adminController.rejectReview);

// Chats
router.get("/chats", chatController.getAdminChats);
router.get("/chats/:id", chatController.getAdminChat);
router.post("/chats/:id/messages", chatUpload.array("photos", 5), chatController.sendAdminMessage);

// Logs
router.get("/logs", adminController.getLogs);

module.exports = router;
