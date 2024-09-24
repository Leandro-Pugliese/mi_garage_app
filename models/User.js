const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    verificado: {
        type: Boolean,
        required: true
    },
    premium: {
        type: Boolean,
        required: true
    },
    vencimientoPremium: {
        type: Date, 
        required: true
    },
    vehiculos: {
        type: [],
        required: true
    },
    categorias: {
        type: [],
        required: true
    },
    ingresos: {
        type: Number,
        required: true
    },
    ultimaConexion: {
        type: Date, 
        required: true
    },
    pais: {
        type: String,
        required: true
    },
    provincia: {
        type: String,
        required: true
    },
    telefono: {
        type: Number,
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

const User = mongoose.model("User", userSchema);

module.exports = User;