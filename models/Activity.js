const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
    user: {
        type: String,
        required: true
    },
    vehicle: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    km: {
        type: Number,
        required: true
    },
    date: {
        type: Date, 
        required: true
    },
    image: {
        url: String,
        public_id: String
    },
    nextDate: {
        type: {},
        required: true
    },
    nextKm: {
        type: {},
        required: true
    },
    active: {
        type: Boolean,
        required: true
    },
    notices: {
        type: {},
        required: true
    }
}, {versionKey: false});

// Indices
activitySchema.index({ user: 1 });
activitySchema.index({ vehicle: 1 });
activitySchema.index({ active: 1 });

const Activitie = mongoose.model("Activitie", activitySchema);

module.exports = Activitie;