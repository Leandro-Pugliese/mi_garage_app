const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true
    },
    user: {
        type: String,
        required: true
    },
    vehicle: {
        type: {},
        required: true
    },
    category: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    km: {
        type: {},
        required: true
    },
    date: {
        type: {},
        required: true
    },
    notices: {
        type: {},
        required: true
    },
    active: {
        type: Boolean,
        required: true
    }
}, {versionKey: false});

const Reminder = mongoose.model("Reminder", reminderSchema);

module.exports = Reminder;