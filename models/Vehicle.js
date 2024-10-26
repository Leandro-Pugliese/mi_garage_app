const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema({
    user: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: true
    },
    model: {
        type: String,
        required: true
    },
    year: {
        type: Number, 
        required: true
    },
    patente: {
        type: String,
        required: true
    },
    fuel: {
        type: String,
        required: true
    },
    gnc: {
        type: Boolean, 
        required: true
    },
    seguro: {
        type: {},
        required: true
    },
    use: {
        type: String,
        required: true
    },
    km: {
        type: Number,
        required: true
    },
    activities: {
        type: [],
        required: true
    },
    created: {
        type: Date, 
        required: true
    },
    updated: {
        type: Date, 
        required: true
    },
    updatedKm: {
        type: Date, 
        required: true
    },
    exOwners: {
        type: [],
        required: true
    },
    blocked: {
        type: Boolean, 
        required: true
    }
}, {versionKey: false});

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

module.exports = Vehicle;