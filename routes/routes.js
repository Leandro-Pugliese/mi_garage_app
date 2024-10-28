const express = require("express");
const router = express.Router();
const {isAuthenticated} = require("../authentication/authentication");
const {isPremium} = require("../authentication/premiumVerification");
const {createUser, loginUser, userData, updateUser, updatePassword, updateCategories, sendEmailValidation, emailValidation, forgotPassword, resetPassword, sendDeleteVerifcation, deleteUser} = require("../controllers/user.controller");
const {createVehicle, vehicleData, vehicleList, updateVehicle, deleteVehicle, sendTransferVehicle} = require("../controllers/vehicle.controller");
const {createActivity, activitiesList, activityData, createActivityPremium, updateActivity, updateActivityPremium, deleteActivity} = require("../controllers/activity.controller");
const {uploadImagen} = require("../assets/multer");
const {createPreference, paymentNotification, paymentRedirect} = require("../assets/mercadoPago");

// User routes.
router.post("/user/create", createUser);
router.post("/user/login", loginUser);
router.get("/user/data", isAuthenticated, userData);
router.put("/user/update-user", isAuthenticated, updateUser);
router.put("/user/update-password", isAuthenticated, updatePassword);
router.put("/user/update-categories", isPremium, updateCategories);
router.get("/user/send-validation", isAuthenticated, sendEmailValidation);
router.put("/user/validation/:id/:token", emailValidation);
router.post("/user/forgot-password", forgotPassword);
router.put("/user/forgot-password/:token", resetPassword);
router.post("/user/send-delete", isAuthenticated, sendDeleteVerifcation);
router.delete("/user/delete/:token", isAuthenticated, deleteUser);

// Vehicle routes.
router.post("/vehicle/create", isAuthenticated, createVehicle);
router.get("/vehicle/data/:id", isAuthenticated, vehicleData);
router.get("/vehicle/list", isAuthenticated, vehicleList);
router.put("/vehicle/update/:id", isAuthenticated, updateVehicle);
router.delete("/vehicle/delete/:id", isAuthenticated, deleteVehicle);
router.post('/vehicle/transfer/send', isPremium, sendTransferVehicle);

// Activity routes.
router.post("/activity/create/:id", isAuthenticated, createActivity);
router.get("/activity/list/:id", isAuthenticated, activitiesList);
router.get("/activity/data/:id", isAuthenticated, activityData);
router.post("/activity/create-premium/:id", isPremium, uploadImagen, createActivityPremium);
router.put("/activity/update/:id", isAuthenticated, updateActivity);
router.put("/activity/update-premium/:id", isPremium, uploadImagen, updateActivityPremium);
router.delete("/activity/delete/:id", isAuthenticated, deleteActivity);

// Payment routes
router.post("/buy/premium", isAuthenticated, createPreference);
router.post("/check/payment", paymentNotification);
router.get("/check/payment-redirect", paymentRedirect);

// Non-existent routes.
router.get("*", (req, res) => {
    return res.status(404).send("¡Esta página no existe!")
})

module.exports = router