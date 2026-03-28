const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");

// Cart routes (require auth)
router.get("/cart", authMiddleware, orderController.getCart);
router.post("/cart/add", authMiddleware, orderController.addToCart);
router.post("/cart/remove", authMiddleware, orderController.removeFromCart);
router.put("/cart/update", authMiddleware, orderController.updateCartItem);
router.delete("/cart/clear", authMiddleware, orderController.clearCart);

// Protected routes (user)
router.post("/", authMiddleware, orderController.createOrder);
router.get("/my-orders", authMiddleware, orderController.getUserOrders);

// Admin routes (to be protected with admin middleware)
router.get("/", authMiddleware, orderController.getAllOrders);
router.put("/:id", authMiddleware, orderController.updateOrder);
router.put("/:id/status", authMiddleware, orderController.updateOrderStatus);
router.delete("/:id", authMiddleware, orderController.deleteOrder);

module.exports = router;
