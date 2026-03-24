const express = require("express");
const router = express.Router();
const yandexDeliveryController = require("../controllers/yandexDeliveryController");

// Публичные маршруты (не требуют авторизации)
router.get("/cities", yandexDeliveryController.getCities);
router.post("/calculate", yandexDeliveryController.calculateDelivery);
router.get("/check", yandexDeliveryController.checkAvailability);
router.get("/search-cities", yandexDeliveryController.searchCitiesEndpoint);

module.exports = router;
