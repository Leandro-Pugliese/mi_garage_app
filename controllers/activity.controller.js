const express = require("express");
const Users = require("../models/User");
const Vehicles = require("../models/Vehicle");
const Activities = require("../models/Activity");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const cloudinary = require('../assets/cloudinary');
const streamifier = require('streamifier');


const createActivity = async (req, res) => {
    const {id} = req.params;
    const {body} = req; //type, description, km, date, isNextDate, nextDate, isNextKm, nextKm.
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
        const activity = await Activities.create({
            user: user._id.toString(),
            vehicle: vehicle._id.toString(),
            type: body.type,
            description: body.description,
            km: Number(body.km),
            date: new Date(body.date),
            image: {
                url: "",
                public_id: ""
            },
            nextDate: {
                tiene: body.isNextDate,
                date: new Date(body.nextDate) || new Date(Date.now())
            },
            nextKm: {
                tiene: body.isNextKm,
                km: Number(body.nextKm) || 0
            },
            active: true,
            notices: {
                cantidad: 0,
                lastNotice: null
            }
        })
        const vehicleActivities = [...vehicle.activities];
        vehicleActivities.push(activity._id.toString());
        await Vehicles.updateOne({_id: vehicle._id},
            {
                $set: {
                    activities: vehicleActivities,
                    updated: new Date(Date.now())
                }
            }
        )
        const msj = "Actividad agregada exitosamente";
        return res.status(200).send({activity, msj});
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const activitiesList = async (req, res) => {
    const {id} = req.params; //vehicleId
    try {
        let activities = await Activities.find({vehicle: id});
        return res.status(200).send(activities);
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const activityData = async (req, res) => {

}

// Función para subir a Cloudinary desde un buffer.
const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
      let stream = cloudinary.uploader.upload_stream((error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      });
      //buffer a stream
      streamifier.createReadStream(buffer).pipe(stream); 
    });
};

const createActivityPremium = async (req, res) => {
    const {id} = req.params;
    const {body} = req; //type, description, km, date, isNextDate, nextDate, isNextKm, nextKm.
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
        // Si no se carga imagen lo dejo vacio.
        let imageUrl = "";
        let imageId = "";
        // Si hay imagen convierto el buffer a stream par subir la imagen a claudinary.
        if (req.file !== undefined) {
            const image = req.file.buffer;
            const uploadedImage = await uploadToCloudinary(image);
            imageUrl = uploadedImage.secure_url; // URL de la imagen.
            imageId = uploadedImage.public_id; // ID de la imagen.
        }
        const activity = await Activities.create({
            user: user._id.toString(),
            vehicle: vehicle._id.toString(),
            type: body.type,
            description: new Date(body.description),
            km: Number(body.km),
            date: new Date(body.date),
            image: {
                url: imageUrl,
                public_id: imageId
            },
            nextDate: {
                tiene: body.isNextDate,
                date: new Date(body.nextDate) || new Date(Date.now())
            },
            nextKm: {
                tiene: body.isNextKm,
                km: Number(body.nextKm) || 0
            },
            active: true,
            notices: {
                cantidad: 0,
                lastNotice: null
            }
        })
        const vehicleActivities = [...vehicle.activities];
        vehicleActivities.push(activity._id.toString());
        await Vehicles.updateOne({_id: vehicle._id},
            {
                $set: {
                    activities: vehicleActivities,
                    updated: new Date(Date.now())
                }
            }
        )
        const msj = "Actividad agregada exitosamente";
        return res.status(200).send({activity, msj});
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const updateActivity = async (req, res) => { //Ruta solo para actividades sin imagen.
    const {id} = req.params;
    const {body} = req; //type, description, km, date, nextDate, nextkm, active.
    try {
        const activity = await Activities.findOne({_id: id});
        if (!activity) {
            return res.status(403).send("Actividad no encontrada en la base de datos.");
        }
        if (activity.image.public_id !== "") {
            return res.status(403).send("Esta actividad tiene una imagen asociada, tienes que usar otra ruta para modificarla.");
        }
        await Activities.updateOne({_id: activity._id},
            {
                $set: {
                    type: body.type || activity.type,
                    description: body.description || activity.description,
                    km: body.km || activity.km,
                    date: new Date(body.date) || activity.date,
                    image: {
                        url: "",
                        public_id: ""
                    },
                    nextDate: {
                        tiene: body.isNextDate === "SI",
                        fecha: new Date(body.nextDate) || new Date()
                    },
                    nextKm: {
                        tiene: body.isNextKm === "SI",
                        kilometraje: Number(body.nextKm) || 0
                    },
                    active: body.active === "SI"
                }
            }
        )
        return res.status(200).send("Actividad modificada exitosamente.");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const updateActivityPremium = async (req, res) => {
    const {id} = req.params;
    const {body} = req; //type, description, km, date, nextDate, nextkm, active.
    try {
        const activity = await Activities.findOne({_id: id});
        if (!activity) {
            return res.status(403).send("Actividad no encontrada en la base de datos.");
        }
        // Si no se carga imagen lo dejo vacio.
        let imageUrl = null;
        let imageId = null;
        // Si hay imagen convierto el buffer a stream par subir la imagen a claudinary.
        if (req.file !== undefined) {
            const image = req.file.buffer;
            const uploadedImage = await uploadToCloudinary(image);
            imageUrl = uploadedImage.secure_url; // URL de la imagen.
            imageId = uploadedImage.public_id; // ID de la imagen.
            await Activities.updateOne({_id: activity._id},
                {
                    $set: {
                        type: body.type || activity.type,
                        description: body.description || activity.description,
                        km: Number(body.km) || activity.km,
                        date: new Date(body.date) || activity.date,
                        image: {
                            url: imageUrl || activity.image.url,
                            public_id: imageId || activity.image.public_id
                        },
                        nextDate: {
                            tiene: body.isNextDate === "SI",
                            date: new Date(body.nextDate) || new Date()
                        },
                        nextKm: {
                            tiene: body.isNextKm === "SI",
                            km: Number(body.nextKm) || 0
                        },
                        active: body.activo === "SI"
                    }
                }
            )
            // Si tiene imagen y la modifica tengo que borrar la vieja de cloudinary.
            if (activity.imagen.public_id !== "") {
                await cloudinary.uploader.destroy(activity.imagen.public_id);
            }
        } else {
            // Si tiene imagen y la quita tengo que borrar la vieja de cloudinary.
            if (activity.imagen.public_id !== "") {
                await cloudinary.uploader.destroy(activity.imagen.public_id);
            }
            await Activities.updateOne({_id: activity._id},
                {
                    $set: {
                        tipo: body.tipo,
                        descripcion: body.descripcion,
                        kilometraje: Number(body.kilometraje),
                        fecha: new Date(body.fecha),
                        imagen: {
                            url: imageUrl,
                            public_id: imageId
                        },
                        proximaFecha: {
                            tiene: body.tieneProximaFecha === "SI",
                            fecha: new Date(body.proximaFecha)
                        },
                        proximoKilometraje: {
                            tiene: body.tieneProximoKilometraje === "SI",
                            kilometraje: Number(body.proximoKilometraje)
                        },
                        activo: body.activo === "SI"
                    }
                }
            )
        }
        return res.status(200).send("Actividad modificada exitosamente.");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const deleteActivity = async (req, res) => {
    const {id} = req.params;
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
        const activity = await Activities.findOne({_id: id});
        if (!activity) {
            return res.status(403).send("Actividad no encontrada en la base de datos.");
        }
        const vehicle = await Vehicles.findOne({_id: activity.vehicle});
        if (!vehicle) {
            return res.status(403).send("Vehículo no encontrado en la base de datos.");
        }
        //Chequeao si tiene imagen.
        if (activity.image.public_id !== "") {
            //Elimino la imagen de cloudinary.
            await cloudinary.uploader.destroy(activity.image.public_id);
        }
        //Elimino la actividad.
        await Activities.deleteOne({_id: activity._id});
        //Quito la actividad del vehiculo.
        const vehicleActivities = [...vehicle.activities];
        const activitiesFilter = vehicleActivities.filter((element) => element !== activity._id.toString());
        await Vehicles.updateOne({_id: vehicle._id},
            {
                $set: {
                    activities: activitiesFilter,
                    updated: new Date(Date.now())
                }
            }
        )
        return res.status(200).send("Actividad eliminada exitosamente.");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

module.exports = {createActivity, activitiesList, createActivityPremium, updateActivity, updateActivityPremium, deleteActivity}