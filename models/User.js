const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    dni: {
        type: Number,
        required: true
    },
    validated: {
        type: Boolean,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    verify: {
        type: Boolean,
        required: true
    },
    twoFactorAuth: {
        type: Boolean,
        required: true
    },
    premium: {
        type: Boolean,
        required: true
    },
    premiumExpiration: {
        type: Date, 
        required: true
    },
    premiumType: {
        type: String, 
        required: true
    },
    freePlan: {
        type: Boolean,
        required: true
    },
    premiumPurchases: {
        type: [],
        required: true
    },
    vehicles: {
        type: [],
        required: true
    },
    transferredVehicles: {
        type: [],
        required: true
    },
    categories: {
        type: [],
        required: true
    },
    notifications: {
        type: [],
        required: true
    },
    transferIterarions: {
        type: {},
        required: true
    },
    totalStorage: {
        type: Number,
        required: true
    },
    emailIterations: {
        type: Number,
        required: true
    },
    entries: {
        type: Number,
        required: true
    },
    lastConection: {
        type: Date, 
        required: true
    },
    country: {
        type: String,
        required: true
    },
    province: {
        type: String,
        required: true
    },
    phone: {
        type: Number,
        required: true
    },
    validatedPhone: {
        type: Boolean,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    salt: {
        type: String,
        required: true
    }
}, {versionKey: false});

// indices
userSchema.index({ premium: 1 });
userSchema.index({ verify: 1 });

const User = mongoose.model("User", userSchema);

module.exports = User;