const express = require("express");
const router = express.Router();
const {isAuthenticated} = require("../authentication/authentication");
const {createUser, loginUser, userData, updateUser, updatePassword, sendEmailValidation, emailValidation, forgotPassword, resetPassword} = require("../controllers/user.controller");

// Routes User.
router.post("/user/create", createUser);
router.post("/user/login", loginUser);
router.get("/user/data", isAuthenticated, userData);
router.put("/user/update-user", isAuthenticated, updateUser);
router.put("/user/update-password", isAuthenticated, updatePassword);
router.get("/user/send-validation", isAuthenticated, sendEmailValidation);
router.put("/user/validation/:id/:token", emailValidation);
router.post("/user/forgot-password", forgotPassword);
router.put("/user/forgot-password/:id/:token", resetPassword);

// Routes inexistentes.
router.get("*", (req, res) => {
    return res.status(404).send("¡Esta página no existe!")
})

module.exports = router