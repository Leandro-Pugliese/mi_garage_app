const express = require("express");
const router = express.Router();
const {isAuthenticated} = require("../authentication/authentication");
const {isPremium} = require("../authentication/premiumVerification");
const {createUser, loginUser, userData, updateUser, updatePassword, updateCategorias, sendEmailValidation, emailValidation, forgotPassword, resetPassword} = require("../controllers/user.controller");
const {createVehicle, vehicleData, vehicleList, updateVehicle} = require("../controllers/vehicle.controller");
const {createActivity, createActivityPremium, updateActivity, deleteActivity} = require("../controllers/activity.controller");
const {uploadImagen} = require("../assets/multer");

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
router.post("/vehicle/data", isAuthenticated, vehicleData);
router.get("/vehicle/list", isAuthenticated, vehicleList);
router.put("/vehicle/update", isAuthenticated, updateVehicle);

// Activity routes.
router.post("/activity/create", isAuthenticated, createActivity);
router.post("/activity/create-premium", isPremium, uploadImagen, createActivityPremium);
router.put("/activity/update", isAuthenticated, updateActivity);
router.delete("/activity/delete", isAuthenticated, deleteActivity);

// Non-existent routes.
router.get("*", (req, res) => {
    return res.status(404).send("¡Esta página no existe!")
})

module.exports = router