const express = require("express");
const mongoose = require('mongoose');
const Users = require("../models/User");
const Vehicles = require("../models/Vehicle");
const Activities = require("../models/Activity");
const Transfers = require("../models/Transfers");
const Notifications = require('../models/Notifications');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require("dotenv").config();
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND);
const { v4: uuidv4 } = require('uuid');

const createVehicle = async (req, res) => {
    const {type, brand, model, year, patente, fuel, gnc, seguro, use, km} = req.body;
    try {
        const token = req.header("Authorization");
        if (!token) {
            return res.status(403).send('No se detecto un token en la petición.')
        }
        const {_id} = jwt.decode(token, {complete: true}).payload
        const user = await Users.findOne({_id: _id});
        if (!user) {
            return res.status(404).send("Usuario no encontrado, token inválido.");
        }
        // Si el usuario no es premium solo puede tener un vehiculo.
        let vehiculosUsuario = [...user.vehicles];
        if ((vehiculosUsuario.length >= 1) && (user.premium === false)) {
            return res.status(403).send("Para agregar más de un vehículo tienes que ser premium.");
        }
        // Si el usuario es premium basic solo puede tener hasta un máximo de 3 vehiculos.
        if ((vehiculosUsuario.length >= 3) && (user.premium === true) && (user.premiumType === 'Basic')) {
            return res.status(403).send("Máximo de vehículos para plan Basic alcanzado (3), tiene que ser premium PLUS para poder agregar más vehículos.");
        }
        //Creamos el vehículo
        const vehicle = await Vehicles.create({
            user: user._id,
            type,
            brand,
            model,
            year,
            patente,
            fuel,
            gnc: gnc === "SI",
            seguro,
            use,
            km,
            activities: [],
            created: new Date(Date.now()),
            updated: new Date(Date.now()),
            updatedKm: new Date(Date.now()),
            oldOwners: [],
            active: true
        })
        //Agregamos el vehículo a la lista del usuario.
        try {
            await Users.updateOne({_id: user._id}, {
                $push: { vehicles: vehicle._id.toString() }
            })
        } catch (error) {
            await Vehicles.deleteOne({_id: vehicle._id}); //Si falla el update user elimino el vehículo creado para no tener datos huerfanos.
            return res.status(502).send('Error update de usuario (borrado de vehículo exitoso).');
        }
        const msj = "Vehículo agregado exitosamente";
        return res.status(201).send({vehicle, msj});
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const vehicleData = async (req, res) => {
    const {id} = req.params //vehiculoID
    try {
        const vehicle = await Vehicles.findOne({_id: id});
        if (!vehicle) {
            return res.status(404).send("Vehículo no encontrado en la base de datos.");
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
            return res.status(404).send("Usuario no encontrado, token inválido.");
        }
        const vehicles = await Vehicles.find();
        if (!vehicles) {
            return res.status(404).send("No se encontraron vehículos en la base de datos.");
        }
        const userVehicles = vehicles.filter((vehicle) => vehicle.user.toString() === user._id.toString()); //Hay que pasarlo sio si a string, el filter no funciona con objectId
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
        //Chequeo de contraseña
        const isMatch = await bcrypt.compare(body.password, user.password);
        if (!isMatch) {
            return res.status(403).send("Contraseña incorrecta.");
        }
        //Elimino el vehiculo
        await Vehicles.deleteOne({_id: id});
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
        return res.status(201).send("Vehículo eliminado exitosamente");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const sendTransferVehicle = async (req, res) => {
    const {id} = req.params //vehiculoID
    const {newOwnerEmail, password} = req.body;
    try {
        const token = req.header("Authorization");
        if (!token) {
            return res.status(403).send('No se detecto un token en la petición.')
        }
        const {_id} = jwt.decode(token, {complete: true}).payload
        const user = await Users.findOne({_id: _id});
        if (!user) {
            return res.status(404).send("Usuario no encontrado, token inválido.");
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(403).send("Contraseña incorrecta.");
        }
        if (!user.premium || !user.verify) {
            return res.status(403).send("Tienes que ser usuario premium y/o tener tu email verificado para poder trasferir un vehículo.");
        }
        if ((user.premiumType === 'Basic') && (user.transferIterations === 2)) {
            return res.status(403).send("Ya utilizaste la cantidad máxima de transferencias de vehículos de tu plan este mes.");
        }
        const newOwner = await Users.findOne({email: newOwnerEmail});
        if (!newOwner) {
            return res.status(404).send("No hay un usuario registrado con el email ingresado.");
        }
        if (!newOwner.verify) {
            return res.status(403).send(`El usuario ${newOwner.email} no tiene su email verificado, por lo tanto no es posible enviar la solicitud de transferencia del vehículo.`);
        }
        if (!newOwner.premium && newOwner.vehicles.length >= 1) {
            return res.status(403).send(`El usuario ${newOwner.email} no puede tener más vehiculos registrados.`);
        }
        if (newOwner.premium && newOwner.premiumType === 'Basic' &&  newOwner.vehicles.length >= 3) {
            return res.status(403).send(`El usuario ${newOwner.email} no puede tener más vehiculos registrados.`);
        }
        const vehicle = await Vehicles.findOne({_id: id});
        if (!vehicle) {
            return res.status(404).send('Vehículo no encontrado en la base de datos.');
        }
        if (!user.vehicles.includes(vehicle._id.toString())) {
            return res.status(403).send('El vehículo no esta en tu lista de vehículos.');
        }
        //Busco si hay alguna trasnfer activa con este vehiculo, solo puede haber una activa con el vehiculo)
        const transferActive = await Transfers.find({status: 'Active', 'vehicle.id': vehicle._id.toString()})
        if (transferActive.length >= 1) {
            return res.status(403).send('Hay una transferencia en curso con este vehículo, no puedes solicitar otra.');
        }
        //Creo la transferencia
        const transfer = await Transfers.create({
            owner: user.email,
            newOwner: newOwner.email,
            vehicle: {
                id: vehicle._id.toString(),
                brand: vehicle.brand,
                model: vehicle.model,
                patente: vehicle.patente
            },
            date: new Date(Date.now()),
            status: 'Active',
            updated: new Date(Date.now())
        });
        const payload = {
            id: transfer._id.toString()
        }
        const newToken = jwt.sign(payload, process.env.JWT_CODE);
        const { error } = await resend.emails.send({
            from: 'Mi Garage <soporteMiGarage@leandro-pugliese.com>',
            to: [newOwner.email],
            subject: 'Transferencia de vehículo',
            html: ` <p>El usuario ${user.email}, quiere trasnferir a tu cuenta el vehículo ${vehicle.brand} ${vehicle.model}, dominio: ${vehicle.patente}</p>
                    <br><strong>Ingresa en el siguiente link para aceptar o cancelar la transferencia: <a href="http://localhost:3000/vehicles/transfer/${newToken}">Click Aqui</a></strong>
                    <br><p>Este es un email automático, no debes responderlo.</p>       
                    <br><p>Si no te registraste en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
        });
        if (error) {
            console.log(error)
            //Si falla el envio del email, elimino la transferencia para que pueda enviar una nueva.
            await Transfers.deleteOne({_id: transfer._id});
            return res.status(400).send("Error al enviar el email con la solicitud de transferencia, intenta enviar una nueva solicitud o comunicate con soporte.");
        }
        //Hago update del usuario con las iteraciones actualizadas.
        await Users.updateOne({_id: user._id},
            {
                $set: {
                    transferIterations: user.transferIterations + 1
                }
            }
        )
        //Creo la notificaciones para los usuarios.
        await Notifications.create([
            {
                user: user._id,
                title: 'Transferencia de vehículo',
                message: `Enviaste una solicitud de transferencia de tu vehículo ${vehicle.brand} ${vehicle.model} patente ${vehicle.patente} al usuario ${newOwner.email}`,
                date: new Date(Date.now()),
                read: false
            },
            {
                user: newOwner._id,
                title: 'Transferencia de vehículo',
                message: `El usuario ${user.email} te envió una solicitud de transferencia del vehículo ${vehicle.brand} ${vehicle.model} dominio ${vehicle.patente}, revisa tu casilla de correo para responder la solicitud de transferencia.`,
                date: new Date(Date.now()),
                read: false
            }
        ]);
        return res.status(201).end('Solicitud de transferencia de vehículo enviada exitosamente.');
    } catch (error) {
        console.log(error);
        return res.status(500).send(error.message);
    }
}

const acceptTransferVehicle = async (req, res) => {
    const {token} = req.params; //Token de la tranferencia.
    const {accepted} = req.body; //true/false
    const session = await mongoose.startSession();//Creo la sesion para evitar inconsistencias en los updates.
    try {
        const {id} = jwt.decode(token, {complete: true}).payload
        const transfer = await Transfers.findOne({_id: id});
        if (!transfer) {
            return res.status(404).send('Transferencia no encontrada en la base de datos.');
        }
        if (transfer.status === 'Complete') {
            return res.status(403).send('La transferencia ya fue completada.');
        }
        if (transfer.status !== 'Active') {
            return res.status(403).send('La transferencia no esta activa.');
        }
        const oldOwner = await Users.findOne({email: transfer.owner});
        if (!oldOwner) {
            return res.status(404).send('Dueño no encontrado en la base de datos.');
        }
        const vehicle = await Vehicles.findOne({_id: transfer.vehicle.id});
        if (!vehicle) {
            return res.status(404).send('Vehículo no encontrado en la base de datos.');
        }
        const newOwner = await Users.findOne({email: transfer.newOwner});
        if (!newOwner) {
            return res.status(404).send('Próximo dueño no encontrado en la base de datos.');
        }
        if ((newOwner.vehicles.length >= 1) && (newOwner.premiumType === 'Default')) {
            return res.status(403).send('No tienes espacio suficiente para agregar otro vehículo, mejora tu plan a premium para agegar más vehículos.');
        }
        if ((newOwner.vehicles.length >= 3) && (newOwner.premiumType === 'Basic')) {
            return res.status(403).send('No tienes espacio suficiente para agregar otro vehículo, mejora tu plan Basic a Plus para poder agregar más vehículos.');
        }
        session.startTransaction(); //Inicializo la session aca, para utilizarla con los updates y las notificaciones.
        if (accepted === true) {
            //Envio notificaciones y correo con info de la trasferencia a oldOwner
            await Notifications.create([
                {
                    user: oldOwner._id,
                    title: 'Transferencia de vehículo',
                    message: `El usuario ${newOwner.email} aceptó la transferencia del vehículo ${vehicle.brand} ${vehicle.model} dominio ${vehicle.patente}. Ya no tienes más acceso al mismo.`,
                    date: new Date(Date.now()),
                    read: false
                },
                {
                    user: newOwner._id,
                    title: 'Transferencia de vehículo',
                    message: `Se completó la transferencia del vehículo ${vehicle.brand} ${vehicle.model} dominio ${vehicle.patente} con el usuario ${newOwner.email}, puedes acceder al mismo desde "Mis Vehículos".`,
                    date: new Date(Date.now()),
                    read: false
                }
            ], {session});
            //Modifico el vehiculo
            await Vehicles.updateOne({_id: vehicle._id},{
                $push: {
                    oldOwners: oldOwner._id.toString()
                },
                $set: {
                    user: newOwner._id
                }
            }, {session});
            //Modifico las actividades del vehiculo
            await Activities.updateMany({user: oldOwner._id.toString()},{
                $set: {
                    user: newOwner._id.toString()
                }
            }, {session});
            //Modifico el status de la transferencia
            await Transfers.updateOne({_id: transfer._id},{
                $set: {
                    status: 'Complete',
                    updated: new Date(Date.now())
                }
            }, {session});
            //Hago updates de los usuarios
            await Users.updateOne({_id: oldOwner._id},{
                $push: {
                    transferredVehicles: vehicle._id.toString()
                },
                $pull: {
                    vehicles: vehicle._id.toString()
                }
            }, {session});
            await Users.updateOne({_id: newOwner._id},{
                $push: {
                    vehicles: vehicle._id.toString()
                }
            }, {session});
            //Si todo se actualizo ok, envio los emails a los usuarios
            if (oldOwner) { //Condicional para poder enviar email de la misma forma debajo en newOwner
                const { error } = await resend.emails.send({
                    from: 'Mi Garage <soporteMiGarage@leandro-pugliese.com>',
                    to: [oldOwner.email],
                    subject: 'Transferencia de vehículo',
                    html: ` <p>La transferencia del vehículo ${vehicle.brand} ${vehicle.model} dominio: ${vehicle.patente} con el usuario ${newOwner.email}, se completó con éxito, ya no tendras acceso al vehículo desde la app.</p>
                            <br><p>Este es un email automático, no debes responderlo.</p>       
                            <br><p>Si no te registraste en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
                });
                if (error) {
                    console.log('Error enviando email al oldOwner en aceptar transferencia (true): ', error)
                }
            }
            const { error } = await resend.emails.send({
                from: 'Mi Garage <soporteMiGarage@leandro-pugliese.com>',
                to: [newOwner.email],
                subject: 'Transferencia de vehículo',
                html: ` <p>La transferencia del vehículo ${vehicle.brand} ${vehicle.model} dominio: ${vehicle.patente} con el usuario ${oldOwner.email}, se completó con éxito, puedes acceder a tu nuevo vehículo desde la <a href="http://localhost:3000/">APP</a>.</p>
                        <br><p>Este es un email automático, no debes responderlo.</p>       
                        <br><p>Si no te registraste en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
            });
            if (error) {
                console.log('Error enviando email al newOwner en aceptar transferencia (true): ', error)
            }
            await session.commitTransaction();
            session.endSession();
            return res.status(200).send('Transferencia aceptada.');
        } else if (accepted === false) {
            await Notifications.create([
                {
                    user: oldOwner._id,
                    title: 'Transferencia de vehículo',
                    message: `El usuario ${newOwner.email} rechazó la transferencia de tu vehículo ${vehicle.brand} ${vehicle.model} dominio ${vehicle.patente}.`,
                    date: new Date(Date.now()),
                    read: false
                },
                {
                    user: newOwner._id,
                    title: 'Transferencia de vehículo',
                    message: `Rechazaste la transferencia del vehículo ${vehicle.brand} ${vehicle.model} patente ${vehicle.patente} con el usuario ${newOwner.email}`,
                    date: new Date(Date.now()),
                    read: false
                }
            ], {session})
            //Modifico el status de la transferencia
            await Transfers.updateOne({_id: transfer._id},{
                $set: {
                    status: 'Rejected',
                    updated: new Date(Date.now())
                }
            }, {session});
            const { error } = await resend.emails.send({
                from: 'Mi Garage <soporteMiGarage@leandro-pugliese.com>',
                to: [oldOwner.email],
                subject: 'Transferencia de vehículo',
                html: ` <p>El usuario ${newOwner.email}, rechazó la transferencia del vehículo ${vehicle.brand} ${vehicle.model}, dominio: ${vehicle.patente}</p>
                        <br><p>Este es un email automático, no debes responderlo.</p>       
                        <br><p>Si no te registraste en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
            });
            if (error) {
                console.log('Error enviando email en aceptar transferencia (false): ', error)
            }
            await session.commitTransaction();
            session.endSession();
            return res.status(200).send('Transferencia rechazada exitosamente.');
        } else {
            return res.status(403).send('Error al aceptar/rechazar la transferencia.');
        }
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.log(error);
        return res.status(500).send(error.message);
    }
}

const cancelTransferVehicle = async (req, res) => {
    const {id} = req.params;
    const session = await mongoose.startSession();
    try {
        const token = req.header("Authorization");
        if (!token) {
            return res.status(403).send('No se detecto un token en la petición.')
        }
        const {_id} = jwt.decode(token, {complete: true}).payload
        const user = await Users.findOne({_id: _id});
        if (!user) {
            return res.status(404).send("Usuario no encontrado, token inválido.");
        }
        const transfer = await Transfers.findOne({_id: id});
        if (!transfer) {
            return res.status(404).send('Transferencia no encontrada en la base de datos.');
        }
        if (transfer.owner !== user.email) {
            return res.status(403).send('La transferencia no pertenece a tu usuario.');
        }
        if (transfer.status === 'Complete') {
            return res.status(403).send('La transferencia ya fue realizada, no puedes cancelarla.');
        }
        const userOther = await Users.findOne({email: transfer.newOwner});
        session.startTransaction();
        if (userOther) { //Si existe el otro usuario, creo ambas notificaciones.
            await Notifications.create([
                {
                    user: user._id,
                    title: 'Transferencia de vehículo',
                    message: `Cancelaste la transferencia de tu vehículo ${transfer.vehicle.brand} ${transfer.vehicle.model} dominio ${transfer.vehicle.patente} con el usuario ${transfer.newOwner}`,
                    date: new Date(Date.now()),
                    read: false
                },
                {
                    user: userOther._id,
                    title: 'Transferencia de vehículo',
                    message: `El usuario ${user.email} canceló la transferencia del vehículo ${transfer.vehicle.brand} ${transfer.vehicle.model} dominio ${transfer.vehicle.patente}.`,
                    date: new Date(Date.now()),
                    read: false
                }
            ], {session});
            const { error } = await resend.emails.send({
                from: 'Mi Garage <soporteMiGarage@leandro-pugliese.com>',
                to: [userOther.email],
                subject: 'Transferencia de vehículo cancelada',
                html: ` <p>El usuario ${user.email}, canceló la transferencia del vehículo ${transfer.vehicle.brand} ${transfer.vehicle.model}, dominio: ${transfer.vehicle.patente}</p>
                        <br><p>Este es un email automático, no debes responderlo.</p>       
                        <br><p>Si no te registraste en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
            });
            if (error) {
                console.log(error)
            }
        } else { //Si el otro usuario fue eliminado, solo genero la notificación para el usuario que cancela la operación.
            await Notifications.create({
                user: user._id,
                title: 'Transferencia de vehículo',
                message: `Cancelaste la transferencia de tu vehículo ${transfer.vehicle.brand} ${transfer.vehicle.model} dominio ${transfer.vehicle.patente} con el usuario ${transfer.newOwner}`,
                date: new Date(Date.now()),
                read: false
            }, {session})
        }
        //Modifico el status de la transferencia
        await Transfers.updateOne({_id: transfer._id},{
            $set: {
                status: 'Canceled',
                updated: new Date(Date.now())
            }
        }, {session});
        await session.commitTransaction();
        session.endSession();
        return res.status(201).send(`Transferencia del vehículo ${transfer.vehicle.patente} cancelada.`);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.log(error);
        return res.status(500).send(error.message);
    }
}

const getDataTransfer = async(req, res) => {
    const {token} = req.params; //Token con id de la operación.
    try {
        const {id} = jwt.decode(token, {complete: true}).payload
        const transfer = await Transfers.findOne({_id: id});
        if (!transfer) {
            return res.status(404).send('Transferencia no encontrada en la base de datos.');
        }
        if (transfer.status === 'Complete') {
            return res.status(403).send('La transferencia ya fue completada.');
        }
        if (transfer.status === 'Rejected') {
            return res.status(403).send('La transferencia ya fue rechazada.');
        }
        if (transfer.status === 'Canceled') {
            return res.status(403).send('La transferencia fue cancelada.');
        }
        return res.status(200).send(transfer);
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

module.exports = {createVehicle, vehicleData, vehicleList, updateVehicle, deleteVehicle, sendTransferVehicle, acceptTransferVehicle, cancelTransferVehicle, getDataTransfer}