const express = require("express");
const router = express.Router();
const {isAuthenticated} = require("../authentication/authentication");
const {isPremium} = require("../authentication/premiumVerification");
const {createUser, loginUser, userData, updateUser, updatePassword, updateCategorias, sendEmailValidation, emailValidation, forgotPassword, resetPassword} = require("../controllers/user.controller");
const {createVehicle, vehicleData, vehicleList, updateVehicle, updateVehicleKm} = require("../controllers/vehicle.controller");
const {createActivity, createActivityPremium, updateActivity, updateActivityPremium, deleteActivity} = require("../controllers/activity.controller");
const {uploadImagen} = require("../assets/multer");
const {createPreference, paymentNotification} = require("../assets/mercadoPago");

// User routes.
router.post("/user/create", createUser);
router.post("/user/login", loginUser);
router.get("/user/data", isAuthenticated, userData);
router.put("/user/update-user", isAuthenticated, updateUser);
router.put("/user/update-password", isAuthenticated, updatePassword);
router.put("/user/update-categorias", isAuthenticated, updateCategorias);
router.get("/user/send-validation", isAuthenticated, sendEmailValidation);
router.put("/user/validation/:id/:token", emailValidation);
router.post("/user/forgot-password", forgotPassword);
router.put("/user/forgot-password/:id/:token", resetPassword);

// Vehicle routes.
router.post("/vehicle/create", isAuthenticated, createVehicle);
router.get("/vehicle/data/:id", isAuthenticated, vehicleData);
router.get("/vehicle/list", isAuthenticated, vehicleList);
router.put("/vehicle/update", isAuthenticated, updateVehicle);
router.put("/vehicle/update-km", isAuthenticated, updateVehicleKm);

// Activity routes.
router.post("/activity/create", isAuthenticated, createActivity);
router.post("/activity/create-premium", isPremium, uploadImagen, createActivityPremium);
router.put("/activity/update", isAuthenticated, updateActivity);
router.put("/activity/update-premium", isPremium, uploadImagen, updateActivityPremium);
router.delete("/activity/delete", isAuthenticated, deleteActivity);

// Mercado pago routes
router.post("/buy/premium", isAuthenticated, createPreference);
router.post("/check/payment", paymentNotification);

// Non-existent routes.
router.get("*", (req, res) => {
    return res.status(404).send("¡Esta página no existe!")
})

module.exports = router