const express = require("express");
const Users = require("../models/User");
const Vehicles = require("../models/Vehicle");
const Activities = require("../models/Activity");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const cloudinary = require('../assets/cloudinary');

const createActivity = async (req, res) => {
    const {body} = req; //vehiculoID, tipo, descripcion, kilometraje, fecha, proximaFecha, proximoKilometraje.
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
        const vehicle = await Vehicles.findOne({_id: body.vehiculoID});
        if (!vehicle) {
            return res.status(403).send("Vehículo no encontrado en la base de datos.");
        }
        const activity = await Activities.create({
            usuario: user._id.toString(),
            vehiculo: vehicle._id.toString(),
            tipo: body.tipo,
            descripcion: body.descripcion,
            kilometraje: body.kilometraje,
            fecha: body.fecha,
            imagen: {
                url: "",
                public_id: ""
            },
            proximaFecha: body.proximaFecha,
            proximoKilometraje: body.proximoKilometraje,
            activo: true
        })
        const vehicleActivities = [...vehicle.actividades];
        vehicleActivities.push(activity._id.toString());
        await Vehicles.updateOne({_id: vehicle._id},
            {
                $set: {
                    actividades: vehicleActivities,
                    actualizado: new Date(Date.now())
                }
            }
        )
        const msj = "Actividad agregada exitosamente";
        return res.status(200).send({activity, msj});
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const createActivityPremium = async (req, res) => {
    const {body} = req; //vehiculoID, tipo, descripcion, kilometraje, fecha, proximaFecha, proximoKilometraje.
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
        const vehicle = await Vehicles.findOne({_id: body.vehiculoID});
        if (!vehicle) {
            return res.status(403).send("Vehículo no encontrado en la base de datos.");
        }
        // Información de la imagen para guardar en Cloudinary.
        // Si no carga imagen lo dejamos vacio.
        let imagenUrl = "";
        let imagenId = "";
        if (req.file !== undefined) {
            imagenUrl = req.file.path; // URL de la imagen.
            imagenId = req.file.filename; // ID de la imagen.
        }
        const activity = await Activities.create({
            usuario: user._id.toString(),
            vehiculo: vehicle._id.toString(),
            tipo: body.tipo,
            descripcion: body.descripcion,
            kilometraje: body.kilometraje,
            fecha: body.fecha,
            imagen: {
                url: imagenUrl,
                public_id: imagenId
            },
            proximaFecha: body.proximaFecha,
            proximoKilometraje: body.proximoKilometraje,
            activo: true
        })
        const vehicleActivities = [...vehicle.actividades];
        vehicleActivities.push(activity._id.toString());
        await Vehicles.updateOne({_id: vehicle._id},
            {
                $set: {
                    actividades: vehicleActivities,
                    actualizado: new Date(Date.now())
                }
            }
        )
        const msj = "Actividad agregada exitosamente";
        return res.status(200).send({activity, msj});
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const updateActivity = async (req, res) => {
    const {body} = req; //actividadID, tipo, descripcion, kilometraje, fecha, proximaFecha, proximoKilometraje, activo.
    try {
        const activity = await Activities.findOne({_id: body.actividadID});
        if (!activity) {
            return res.status(403).send("Actividad no encontrada en la base de datos.");
        }
        await Activities.updateOne({_id: activity._id},
            {
                $set: {
                    tipo: body.tipo,
                    descripcion: body.descripcion,
                    kilometraje: body.kilometraje,
                    fecha: body.fecha,
                    proximaFecha: body.proximaFecha,
                    proximoKilometraje: body.proximoKilometraje,
                    activo: body.activo
                }
            }
        )
        return res.status(200).send("Actividad modificada exitosamente.");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const deleteActivity = async (req, res) => {
    const {body} = req; //actividadID.
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
        const activity = await Activities.findOne({_id: body.actividadID});
        if (!activity) {
            return res.status(403).send("Actividad no encontrada en la base de datos.");
        }
        const vehicle = await Vehicles.findOne({_id: activity.vehiculo});
        if (!vehicle) {
            return res.status(403).send("Vehículo no encontrado en la base de datos.");
        }
        //Chequeao si tiene imagen.
        if (activity.imagen.public_id !== "") {
            //Elimino la imagen de cloudinary.
            await cloudinary.uploader.destroy(activity.imagen.public_id);
        }
        //Elimino la actividad.
        await Activities.deleteOne({_id: activity._id});
        //Quito la actividad del vehiculo.
        const vehicleActivities = [...vehicle.actividades];
        const activitiesFilter = vehicleActivities.filter((element) => element !== activity._id.toString());
        await Vehicles.updateOne({_id: vehicle._id},
            {
                $set: {
                    actividades: activitiesFilter,
                    actualizado: new Date(Date.now())
                }
            }
        )
        return res.status(200).send("Actividad eliminada exitosamente.");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

module.exports = {createActivity, createActivityPremium, updateActivity, deleteActivity}