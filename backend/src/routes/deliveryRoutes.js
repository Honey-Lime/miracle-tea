const express = require("express");
const router = express.Router();
const deliveryController = require("../controllers/deliveryController");

// Ключи служб доставки хранятся только на сервере: клиент обращается к ним через эти маршруты.
router.post("/state", deliveryController.getState);
router.post("/calculation", deliveryController.calculate);

module.exports = router;
