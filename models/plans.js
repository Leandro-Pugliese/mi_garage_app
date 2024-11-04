const mongoose = require("mongoose");

const plansSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    months: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    includes: {
        type: [],
        required: true
    },
    active: {
        type: Boolean,
        required: true
    }
}, {versionKey: false});

const Plan = mongoose.model("Plan", plansSchema);

module.exports = Plan;