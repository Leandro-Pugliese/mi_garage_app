const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema({
    usuario: {
        type: String,
        required: true
    },
    tipo: {
        type: String,
        required: true
    },
    marca: {
        type: String,
        required: true
    },
    modelo: {
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
    combustible: {
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
    uso: {
        type: String,
        required: true
    },
    kilometraje: {
        type: Number,
        required: true
    },
    actividades: {
        type: [],
        required: true
    },
    creado: {
        type: Date, 
        required: true
    },
    actualizado: {
        type: Date, 
        required: true
    },
}, {versionKey: false});

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

module.exports = Vehicle;