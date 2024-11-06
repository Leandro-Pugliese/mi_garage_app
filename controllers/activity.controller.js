const express = require("express");
const Users = require("../models/User");
const Vehicles = require("../models/Vehicle");
const Activities = require("../models/Activity");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
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
    const {id} = req.params //activityID
    try {
        const activity = await Activities.findOne({_id: id});
        if (!activity) {
            return res.status(403).send("Actividad no encontrada en la base de datos.");
        }
        return res.status(200).send(activity);
    } catch (error) {
        return res.status(500).send(error.message);
    }
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
        let imageSizeMB = 0;
        let MAX_STORAGE_LIMIT_MB = 0;
        if (user.premiumType === 'Basic') {
            MAX_STORAGE_LIMIT_MB = 500;
        } 
        if (user.premiumType === 'Plus') {
            MAX_STORAGE_LIMIT_MB = 2000;
        }
        // Si hay imagen convierto el buffer a stream par subir la imagen a claudinary.
        if (req.file !== undefined) {
            imageSizeMB = req.file.size / (1024 * 1024); // Convierto de bytes a MB
            // Verifico si el tamaño total excede el límite del usuario
            const newTotalStorage = (user.totalStorage || 0) + imageSizeMB;
            if (newTotalStorage > MAX_STORAGE_LIMIT_MB) {
                return res.status(403).send("Límite de almacenamiento excedido.");
            }
            const image = req.file.buffer;
            const uploadedImage = await uploadToCloudinary(image);
            imageUrl = uploadedImage.secure_url; // URL de la imagen.
            imageId = uploadedImage.public_id; // ID de la imagen.

            // Actualizo el almacenamiento total del usuario
            await Users.updateOne({ _id: user._id }, { totalStorage: newTotalStorage });
        }
        const activity = await Activities.create({
            user: user._id.toString(),
            vehicle: vehicle._id.toString(),
            type: body.type,
            description: body.description,
            km: Number(body.km),
            date: new Date(body.date) || new Date(Date.now()),
            image: {
                url: imageUrl,
                public_id: imageId
            },
            nextDate: {
                tiene: body.isNextDate === "true", //Esta info viene en formData (string)
                date: new Date(body.nextDate) || new Date(Date.now())
            },
            nextKm: {
                tiene: body.isNextKm === "true",
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
                    activities: vehicleActivities
                }
            }
        )
        const msj = "Actividad agregada exitosamente";
        return res.status(200).send({activity, msj});
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const updateActivity = async (req, res) => { //Ruta solo para usuarios no premium.
    const {id} = req.params;
    const {body} = req; //type, description, km, date, isNextDate, nextDate, isNextkm, nextkm, active, deleteImage.
    try {
        const activity = await Activities.findOne({_id: id});
        if (!activity) {
            return res.status(403).send("Actividad no encontrada en la base de datos.");
        }
        let isDate = null;
        if (body.date !== null) {
            isDate = new Date(body.date)
        }
        let nextDateChanged = null;
        if (body.nextDate !== null) {
            nextDateChanged = new Date(body.nextDate)
        }
        //No se puede modificar la imagen si no sos premium(si eras, cargaste una foto y no sos mas premium, solo podes eliminar la foto)
        if (body.deleteImage === true) {
            await Activities.updateOne({_id: activity._id},
                {
                    $set: {
                        type: body.type || activity.type,
                        description: body.description || activity.description,
                        km: Number(body.km) || activity.km,
                        date: isDate || activity.date,
                        image: { 
                            url: "",
                            public_id: ""
                        },
                        nextDate: {
                            tiene: body.isNextDate || activity.nextDate.tiene,
                            date: nextDateChanged || activity.nextDate.date
                        },
                        nextKm: {
                            tiene: body.isNextKm || activity.nextKm.tiene,
                            km: Number(body.nextKm) || activity.nextKm.km
                        },
                        active: body.active
                    }
                }
            )
            if (activity.image.public_id !== "") {
                await cloudinary.uploader.destroy(activity.image.public_id);
            }
            return res.status(200).send("Actividad modificada exitosamente.");
        } else if (body.deleteImage === false) {
            await Activities.updateOne({_id: activity._id},
                {
                    $set: {
                        type: body.type || activity.type,
                        description: body.description || activity.description,
                        km: Number(body.km) || activity.km,
                        date: isDate || activity.date,
                        nextDate: {
                            tiene: body.isNextDate || activity.nextDate.tiene,
                            date: nextDateChanged || activity.nextDate.date
                        },
                        nextKm: {
                            tiene: body.isNextKm || activity.nextKm.tiene ,
                            km: Number(body.nextKm) || activity.nextKm.km 
                        },
                        active: body.active
                    }
                }
            )
            return res.status(200).send("Actividad modificada exitosamente.");
        } else {
            return res.status(403).send("Borrado de imagen no definido.");
        }
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const updateActivityPremium = async (req, res) => {
    const {id} = req.params;
    const {body} = req; //type, description, km, date, isNextDate, nextDate, isNextKm, nextkm, active, deleteImage.
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
        //Transformo la info viene en string, porque es formData
        let hasNextDate = null;
        if (body.isNextDate === "true" || body.isNextDate === "false") {
            hasNextDate = body.isNextDate === "true"; //Lo convierto en boolean
        }
        let nextDateChanged = null;
        if (body.nextDate !== "null") {
            nextDateChanged = new Date(body.nextDate);
        }
        let hasNextKm = null;
        if (body.isNextKm === "true" || body.isNextKm === "false") {
            hasNextKm = body.isNextKm === "true";
        }
        let isType = null;
        if (body.type !== "undefined") {
            isType = body.type
        }
        let isDate = null;
        if (body.date !== "null") {
            isDate = new Date(body.date)
        }
        let isDescription = null;
        if (body.description !== "null") {
            isDescription = body.description
        }
        //Chequeo si va a borrar la imagen o no
        if (body.deleteImage === "false") {
            // Si no se carga imagen lo dejo vacio.
            let imageUrl = null;
            let imageId = null;
            let imageSizeMB = 0;
            let MAX_STORAGE_LIMIT_MB = 0;
            if (user.premiumType === 'Basic') {
                MAX_STORAGE_LIMIT_MB = 500;
            } 
            if (user.premiumType === 'Plus') {
                MAX_STORAGE_LIMIT_MB = 2000;
            }
            // Si hay imagen convierto el buffer a stream par subir la imagen a claudinary
            if (req.file !== undefined) {
                imageSizeMB = req.file.size / (1024 * 1024); // Convierto de bytes a MB
                // Verifico si el tamaño total excede el límite del usuario
                const newTotalStorage = (user.totalStorage || 0) + imageSizeMB;
                if (newTotalStorage > MAX_STORAGE_LIMIT_MB) {
                    return res.status(403).send("Límite de almacenamiento excedido.");
                }
                const image = req.file.buffer;
                const uploadedImage = await uploadToCloudinary(image);
                imageUrl = uploadedImage.secure_url; // URL de la imagen
                imageId = uploadedImage.public_id; // ID de la imagen

                // Actualizo el almacenamiento total del usuario
                await Users.updateOne({ _id: user._id }, { totalStorage: newTotalStorage });
            }
            await Activities.updateOne({_id: activity._id},
                {
                    $set: {
                        type: isType || activity.type,
                        description: isDescription || activity.description,
                        km: Number(body.km) || activity.km,
                        date: isDate || activity.date,
                        image: {
                            url: imageUrl || activity.image.url,
                            public_id: imageId || activity.image.public_id
                        },
                        nextDate: {
                            tiene: hasNextDate === true || activity.nextDate.tiene,
                            date: nextDateChanged || activity.nextDate.date
                        },
                        nextKm: {
                            tiene: hasNextKm === true || activity.nextKm.tiene,
                            km: Number(body.nextKm) || activity.nextKm.km
                        },
                        active: body.active === "true"
                    }
                }
            )
            // Si tiene imagen y la modifica tengo que borrar la vieja de cloudinary.
            if ((activity.image.public_id !== "") && (req.file !== undefined)) {
                await cloudinary.uploader.destroy(activity.image.public_id);
            }
            return res.status(200).send("Actividad modificada exitosamente.");
        } else if (body.deleteImage === "true") {
            await Activities.updateOne({_id: activity._id},
                {
                    $set: {
                        type: isType || activity.type,
                        description: isDescription || activity.description,
                        km: Number(body.km) || activity.km,
                        date: isDate || activity.date,
                        image: {
                            url: "",
                            public_id: ""
                        },
                        nextDate: {
                            tiene: hasNextDate === true || activity.nextDate.tiene,
                            date: nextDateChanged || activity.nextDate.date
                        },
                        nextKm: {
                            tiene: hasNextKm === true || activity.nextKm.tiene,
                            km: Number(body.nextKm) || activity.nextKm.km
                        },
                        active: body.active === "true"
                    }
                }
            )
            // Borro la imagen de cloudinary.
            if (activity.image.public_id !== "") {
                await cloudinary.uploader.destroy(activity.image.public_id);
            }
            return res.status(200).send("Actividad modificada exitosamente.");
        } else {
            return res.status(403).send("Borrado de imagen no definido.");
        }
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const deleteActivity = async (req, res) => {
    const {id} = req.params;
    const {body} = req;
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
        //Chequeo de contraseña
        const isMatch = await bcrypt.compare(body.password, user.password);
        if (!isMatch) {
            return res.status(403).send("Contraseña incorrecta.");
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

module.exports = {createActivity, activitiesList, activityData, createActivityPremium, updateActivity, updateActivityPremium, deleteActivity}