const express = require("express");
const Users = require("../models/User");
const Vehicles = require("../models/Vehicle");
const Activities = require("../models/Activity");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
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
        let vehiculosUsuario = [...user.vehicles];
        if ((vehiculosUsuario.length >= 1) && (user.premium === false)) {
            return res.status(403).send("Para agregar más de un vehículo tienes que ser premium.");
        }
        //Creamos el vehículo
        const vehicle = await Vehicles.create({
            user: user._id.toString(),
            type: body.type,
            brand: body.brand,
            model: body.model,
            year: body.year,
            patente: body.patente,
            fuel: body.fuel,
            gnc: body.gnc === "SI",
            seguro: body.seguro,
            use: body.use,
            km: body.km,
            activities: [],
            created: new Date(Date.now()),
            updated: new Date(Date.now()),
            updatedKm: new Date(Date.now())
        })
        //Agregamos el vehículo a la lista del usuario.
        vehiculosUsuario.push(vehicle._id.toString());
        await Users.updateOne({_id: user._id},
            {
                $set: {
                    vehicles: vehiculosUsuario
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
        const userVehicles = vehicles.filter((vehicle) => vehicle.user === user._id.toString());
        return res.status(200).send(userVehicles);
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const updateVehicle = async (req, res) => {
    const {id} = req.params
    const {body} = req; //type, brand, model, year, patente, fuel, gnc, company, coverage, use, km
    try {
        const vehicle = await Vehicles.findOne({_id: id});
        if (!vehicle) {
            return res.status(403).send("Vehículo no encontrado en la base de datos.");
        }
        await Vehicles.updateOne({_id: vehicle._id},
            {
                $set: {
                    type: body.type || vehicle.tipo,
                    brand: body.brand || vehicle.marca,
                    model: body.model || vehicle.modelo,
                    year: body.year || vehicle.year,
                    patente: body.patente || vehicle.patente,
                    fuel: body.fuel || vehicle.fuel,
                    gnc: body.gnc || vehicle.gnc,
                    seguro: {
                        aseguradora: body.company || vehicle.seguro.aseguradora,
                        cobertura: body.coverage || vehicle.seguro.cobertura
                    },
                    use: body.use || vehicle.use,
                    km: body.km || vehicle.km,
                    updated: new Date(Date.now()),
                    ...(body.km && {updatedKm: new Date(Date.now())})
                }
            }
        )
        return res.status(200).send("Datos del vehículo modificados exitosamente");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const deleteVehicle = async (req, res) => {
    const {id} = req.params //vehiculoID
    const {body} = req; //Password
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
        const vehicle = await Vehicles.findOne({_id: id});
        if (!vehicle) {
            return res.status(403).send("Vehículo no encontrado en la base de datos.");
        }
        //Chequeo de contraseña
        const isMatch = await bcrypt.compare(body.password, user.password);
        if (!isMatch) {
            return res.status(403).send("Contraseña incorrecta.");
        }
        //Elimino el vehiculo
        await Vehicles.deleteOne({_id: vehicle._id});
        //Si hay actividades que pertenecen al vehiculo, las elimino tambien
        await Activities.deleteMany({vehicle: id});
        //Hago update del usuario quitando el id del vehiculo
        const userVehicles = [...user.vehicles];
        const newVehiclesList = userVehicles.filter((vehicle) => vehicle !== id)
        await Users.updateOne({_id: user._id},
            {
                $set: {
                    vehicles: newVehiclesList
                }
            }
        )
        return res.status(200).send("Vehículo eliminado exitosamente");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

module.exports = {createVehicle, vehicleData, vehicleList, updateVehicle, deleteVehicle}