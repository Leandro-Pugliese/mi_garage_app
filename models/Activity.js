const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
    usuario: {
        type: String,
        required: true
    },
    vehiculo: {
        type: String,
        required: true
    },
    tipo: {
        type: String,
        required: true
    },
    descripcion: {
        type: String,
        required: true
    },
    kilometraje: {
        type: Number,
        required: true
    },
    fecha: {
        type: Date, 
        required: true
    },
    imagen: {
        url: String,
        public_id: String
    },
    proximaFecha: {
        type: {},
        required: true
    },
    proximoKilometraje: {
        type: {},
        required: true
    },
    activo: {
        type: Boolean,
        required: true
    }
}, {versionKey: false});

const Activitie = mongoose.model("Activitie", activitySchema);

module.exports = Activitie;