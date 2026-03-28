const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const upload = require("../middleware/uploadMiddleware");

// All admin routes require authentication and admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

// Orders
router.get("/orders", adminController.getAllOrders);
router.put("/orders/:id/status", adminController.updateOrderStatus);

// Products
router.get("/products", adminController.getAllProducts);
router.post("/products", adminController.addProduct);
router.get("/products/search", adminController.searchProducts);
router.put("/products/stock", adminController.addStock);
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

// Tags
router.get("/products/tags", adminController.getAllTags);
router.post("/products/tags", adminController.createTag);
router.put("/products/add-tag", adminController.addTagToProduct);
router.put("/products/remove-tag", adminController.removeTagFromProduct);

module.exports = router;
