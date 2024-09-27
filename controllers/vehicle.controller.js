const express = require("express");
const Users = require("../models/User");
const Vehicles = require("../models/Vehicle");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const createVehicle = async (req, res) => {
    const {body} = req; //type, brand, model, year, patente, fuel, gnc, seguro, use, km
    try {
        const token = req.header("Authorization");
        if (!token) {
            return res.status(403).send('No se detecto un token en la petición.')
        }
        const {_id} = jwt.decode(token, {complete: true}).payload
        const user = await Users.findOne({_id: _id});
        if (!user) {
            return res.status(403).send("Usuario no encontrado, token inválido.");
        }
        // Si el usuario no es premium solo puede tener un vehiculo.
        let vehiculosUsuario = [...user.vehiculos];
        if ((vehiculosUsuario.length >= 1) && (user.premium === false)) {
            return res.status(403).send("Para agregar más de un vehículo tienes que ser premium.");
        }
        //Creamos el vehículo
        const vehicle = await Vehicles.create({
            usuario: user._id.toString(),
            tipo: body.type,
            marca: body.brand,
            modelo: body.model,
            year: body.year,
            patente: body.patente,
            combustible: body.fuel,
            gnc: body.gnc === "SI",
            seguro: body.seguro,
            uso: body.use,
            kilometraje: body.km,
            actividades: [],
            creado: new Date(Date.now()),
            actualizado: new Date(Date.now()),
            kilometrajeActualizado: new Date(Date.now())
        })
        //Agregamos el vehículo a la lista del usuario.
        vehiculosUsuario.push(vehicle._id.toString());
        await Users.updateOne({_id: user._id},
            {
                $set: {
                    vehiculos: vehiculosUsuario
                }
            }
        )
        const msj = "Vehículo agregado exitosamente";
        return res.status(200).send({vehicle, msj});
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const vehicleData = async (req, res) => {
    const {id} = req.params //vehiculoID
    try {
        const vehicle = await Vehicles.findOne({_id: id});
        if (!vehicle) {
            return res.status(403).send("Vehículo no encontrado en la base de datos.");
        }
        return res.status(200).send(vehicle);
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const vehicleList = async (req, res) => {
    try {
        const token = req.header("Authorization");
        if (!token) {
            return res.status(403).send('No se detecto un token en la petición.')
        }
        const {_id} = jwt.decode(token, {complete: true}).payload
        const user = await Users.findOne({_id: _id});
        if (!user) {
            return res.status(403).send("Usuario no encontrado, token inválido.");
        }
        const vehicles = await Vehicles.find();
        if (!vehicles) {
            return res.status(403).send("No se encontraron vehículos en la base de datos.");
        }
        const userVehicles = vehicles.filter((vehicle) => vehicle.usuario === user._id.toString());
        return res.status(200).send(userVehicles);
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const updateVehicle = async (req, res) => {
    const {body} = req; //vehiculoID, tipoVehiculo, marca, modelo, year, patente, combustible, gnc, seguro, uso.
    try {
        const vehicle = await Vehicles.findOne({_id: body.vehiculoID});
        if (!vehicle) {
            return res.status(403).send("Vehículo no encontrado en la base de datos.");
        }
        await Vehicles.updateOne({_id: vehicle._id},
            {
                $set: {
                    tipo: body.tipoVehiculo,
                    marca: body.marca,
                    modelo: body.modelo,
                    year: body.year,
                    patente: body.patente,
                    combustible: body.combustible,
                    gnc: body.gnc,
                    seguro: body.seguro,
                    uso: body.uso,
                    actualizado: new Date(Date.now())
                }
            }
        )
        return res.status(200).send("Datos del vehículo modificados exitosamente");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const updateVehicleKm = async (req, res) => {
    const {body} = req; //vehiculoID, kilometraje
    try {
        const vehicle = await Vehicles.findOne({_id: body.vehiculoID});
        if (!vehicle) {
            return res.status(403).send("Vehículo no encontrado en la base de datos.");
        }
        await Vehicles.updateOne({_id: vehicle._id},
            {
                $set: {
                    kilometraje: body.kilometraje,
                    kilometrajeActualizado: new Date(Date.now())
                }
            }
        )
        return res.status(200).send("Kilometraje del vehículo modificado exitosamente.");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

module.exports = {createVehicle, vehicleData, vehicleList, updateVehicle, updateVehicleKm}