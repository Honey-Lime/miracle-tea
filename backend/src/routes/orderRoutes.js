const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");

const optionalAuthMiddleware = (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return next();
  }

  return authMiddleware(req, res, next);
};

// Cart routes (require auth)
router.get("/cart", authMiddleware, orderController.getCart);
router.post("/cart/add", authMiddleware, orderController.addToCart);
router.post("/cart/remove", authMiddleware, orderController.removeFromCart);
router.put("/cart/update", authMiddleware, orderController.updateCartItem);
router.delete("/cart/clear", authMiddleware, orderController.clearCart);

// Order creation is available both for authorized users and guests.
router.post("/", optionalAuthMiddleware, orderController.createOrder);
router.get("/my-orders", authMiddleware, orderController.getUserOrders);
router.put("/:id/cancel", authMiddleware, orderController.cancelUserOrder);

// Admin routes (to be protected with admin middleware)
router.get("/", authMiddleware, orderController.getAllOrders);
router.put("/:id", authMiddleware, orderController.updateOrder);
router.put("/:id/status", authMiddleware, orderController.updateOrderStatus);
router.delete("/:id", authMiddleware, orderController.deleteOrder);

module.exports = router;
