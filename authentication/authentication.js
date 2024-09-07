const express = require("express");
const jwt = require("jsonwebtoken");
const Users = require("../models/User")
require("dotenv").config();

// Middleware para rutas con autenticación.
const isAuthenticated = async (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) {
        return res.status(403).send('No se detecto un token en la petición.')
    }
    try {
        const {_id} = jwt.verify(token, process.env.JWT_CODE)
        const user = await Users.findOne({_id: _id});
        if (!user) {
            return res.status(403).send('Token inválido, no se encontro el usuario en la base de datos.')
        }
        req.user = user
        next()
    } catch (error) {
        return res.status(500).send(error)
    }
};

module.exports = { isAuthenticated }