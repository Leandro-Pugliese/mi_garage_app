const express = require("express");
const Users = require("../models/User");
const Vehicles = require("../models/Vehicle");
const Activities = require("../models/Activity");
const schedule = require('node-schedule');
const { differenceInDays, subDays, isAfter, isBefore } = require('date-fns');
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND);

const checkKm = async (req, res) => {
    try {
        const users = await Users.find();
        if (users.length === 0) {
            return
        }
        for (let i=0; i < users.length; i++) {
            if (users[i].verificado === true) {
                const userVehiclesList = users[i].vehiculos
                for (let x=0; x < userVehiclesList.length; x++) {
                    const vehicle = await Vehicles.findOne({_id: userVehiclesList[x]});
                    if (vehicle) {
                        //Chequeo cuando fue modificado el kilometraje de cada vehículo.
                        const updateKmDate = new Date(vehicle.kilometrajeActualizado);
                        const currentDate = new Date(Date.now());
                        // Calculo la diferencia en días.
                        const diffInDays = differenceInDays(currentDate, updateKmDate);
                        if (users[i].premium === true) {
                            if (diffInDays >= 5) {
                                const { error } = await resend.emails.send({
                                    from: 'Mi Garage <avisosMiGarage@leandro-pugliese.com>',
                                    to: [users[i].email],
                                    subject: 'Actualización de vehículo',
                                    html: ` <strong>Hola, hace un tiempo que no actualizas el kilometraje de tu vehículo patente:${vehicle.patente}, si usaste tu vehículo puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y actualizar el kilometraje para mantener los avisos al día.</strong>
                                            <br><p>Si no estas registrado en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
                                });
                                if (error) {
                                    console.log(error);
                                }
                            }
                        } else {
                            if (diffInDays >= 26) {
                                const { error } = await resend.emails.send({
                                    from: 'Mi Garage <avisosMiGarage@leandro-pugliese.com>',
                                    to: [users[i].email],
                                    subject: 'Actualización de vehículo',
                                    html: ` <strong>Hola, hace un tiempo que no actualizas el kilometraje de tu vehículo patente:${vehicle.patente}, si usaste tu vehículo puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y actualizar el kilometraje para mantener los avisos al día.</strong>
                                            <br><p>Si no estas registrado en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
                                });
                                if (error) {
                                    console.log(error);
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        return console.log(error.message);
    }
}

const checkPremium = async (req, res) => {
    try {
        const users = await Users.find();
        if (users.length === 0) {
            return
        }
        for (let i=0; i < users.length; i++) {
            if (users[i].premium === true && users[i].verificado === true) {
                //Chequeo cuando fue modificado el kilometraje de cada vehículo.
                const premiumExpiration = new Date(users[i].vencimientoPremium);
                const currentDate = new Date(Date.now());
                // Resto 7 días a la fecha de vencimiento.
                const reminderDate = subDays(premiumExpiration, 7);
                // Chequeo si falta menos de una semana para el vencimiento y todavia no paso la fecha.
                if (isAfter(currentDate, reminderDate) && isBefore(currentDate, premiumExpiration)) {
                    const { error } = await resend.emails.send({
                        from: 'Mi Garage <avisosMiGarage@leandro-pugliese.com>',
                        to: [users[i].email],
                        subject: 'Vencimiento membresía premium',
                        html: ` <strong>¡Hola, este correo es para recordarte que se aproxima el vencimiento de tu membresía premium!</strong>
                                <br><strong>Fecha de vencimiento: ${users[i].vencimientoPremium.toLocaleDateString()}, puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y renovar tu membresía premium para seguir aprovenchando al máximo las funcionalidades de la app.</strong>
                                <br><p>Si ya renovaste tu membresía premium ignora este email.</p>
                                <br><p>Si no estas registrado en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
                    });
                    if (error) {
                        console.log(error);
                    }
                }
            }
        }
    } catch (error) {
        return console.log(error.message);
    }
}

const checkActivity = async (req, res) => {
    try {
        const users = await Users.find();
        if (users.length === 0) {
            return
        }
        for (let i=0; i < users.length; i++) {
            if (users[i].verificado === true && users[i].premium === true) {
                const userVehiclesList = users[i].vehiculos
                for (let x=0; x < userVehiclesList.length; x++) {
                    const vehicle = await Vehicles.findOne({_id: userVehiclesList[x]});
                    if (vehicle) {
                        const vehicleActivities = vehicle.actividades
                        if (vehicleActivities.length >= 1) {
                            for (let z=0; z < vehicleActivities.length; z++) {
                                const activity = await Activities.findOne({_id: vehicleActivities[z]});
                                if (activity) {
                                    const avisosNumber =  activity.avisos.cantidad;
                                    const avisoDate = new Date(activity.avisos.ultimoAviso);
                                    const currentDate = new Date(Date.now()); 
                                    const DiffAviso = differenceInDays(avisoDate, currentDate);
                                    if ((avisosNumber <= 3) && (DiffAviso >= 2)) {
                                        //Cargo los datos del vehículo y la actividad.
                                        let vehicleKm = null; 
                                        let expiryKm = null;
                                        if (activity.proximoKilometraje.tiene === true) {
                                            vehicleKm = vehicle.kilometraje; 
                                            expiryKm = activity.proximoKilometraje.kilometraje;
                                        }
                                        let expiryDate = null; 
                                        if (activity.proximaFecha.tiene === true) {
                                            expiryDate = activity.proximaFecha.fecha
                                        }
                                        //Seteo el margen para kilómetros y fechas.
                                        const kmMargin = 1000;
                                        const daysMargin = 7; 
                                        // Chequeo de kilómetros
                                        let kmAlert = false;
                                        if (expiryKm) {
                                            kmAlert = vehicleKm >= (expiryKm - kmMargin);
                                        }
                                        // Chequeo de fecha
                                        let dateAlert = false;
                                        if (expiryDate) {
                                            const daysDiff = differenceInDays(expiryDate, currentDate);
                                            dateAlert = daysDiff <= daysMargin;
                                        }
                                        let msjHtml = null;
                                        if (kmAlert && dateAlert) {
                                            msjHtml = `<strong>La actividad: ${activity.tipo} (${activity.descripcion}) debe realizarse pronto. 
                                                        Debes realizarla cuando el vehículo alcance los ${expiryKm}km o antes del ${expiryDate.toLocaleDateString()} (Tu vehíclo tiene ${vehicle.kilometraje}km).</strong>
                                                        <br/><p>Si ya realizaste la actividad en tu vehiculo, te pedimos que actualices su estado <a href="http://localhost:3000">INGRESANDO A LA APP</a> para no recibir más esta alerta.</p>`;
                                        } else if (kmAlert) {
                                            msjHtml = `<strong>La actividad: ${activity.tipo} (${activity.descripcion}) debe realizarse pronto. 
                                                        Debes realizarla cuando el vehículo alcance los ${expiryKm}km (Tu vehíclo tiene ${vehicle.kilometraje}km).</strong>
                                                        <br/><p>Si ya realizaste la actividad en tu vehiculo, te pedimos que actualices su estado <a href="http://localhost:3000">INGRESANDO A LA APP</a> para no recibir más esta alerta.<p/>`;
                                        } else if (dateAlert) {
                                            msjHtml = `<strong>La actividad: ${activity.tipo} (${activity.descripcion}) debe realizarse pronto. 
                                                        Debes realizarla antes del ${expiryDate.toLocaleDateString()}.</strong>
                                                        <br/><p>Si ya realizaste la actividad en tu vehiculo, te pedimos que actualices su estado <a href="http://localhost:3000">INGRESANDO A LA APP</a> para no recibir más esta alerta.<p/>`;
                                        }
                                        if (msjHtml) {
                                            //Envio el correo.
                                            const { error } = await resend.emails.send({
                                                from: 'Mi Garage <avisosMiGarage@leandro-pugliese.com>',
                                                to: [users[i].email],
                                                subject: `Realizar ${activity.tipo} al vehículo`,
                                                html: msjHtml,
                                            });
                                            if (error) {
                                                console.log(error);
                                            }
                                            if (!error) {
                                                await Activities.updateOne({_id: activity._id},
                                                    {
                                                        $set: {
                                                            avisos: {
                                                                cantidad: avisosNumber + 1,
                                                                ultimoAviso: new Date(Date.now())
                                                            }
                                                        }
                                                    }
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        return console.log(error.message);
    }
}

//Cron-job para ejecutarse los miercoles y domingos a las 22hs.
const cronJob = () => {
    schedule.scheduleJob({ hour: 22, minute: 0, dayOfWeek: [0,1, 3] }, () => {
        console.log('Ejecutando tarea del miercoles y domingos a las 22:00hs');
        checkKm();
    })
}
//Cron-job para ejecutarse todos los días a la medianoche.
const cronJob1 = () => {
    schedule.scheduleJob({ hour: 0, minute: 0, dayOfWeek: [0, 1, 2, 3, 4, 5, 6] }, () => {
        console.log('Ejecutando tarea todos los dias a la medianoche');
        checkPremium();
    })
}
//Cron-job para ejecutarse todos los días a las 6am.
const cronJob2 = () => { 
    schedule.scheduleJob({ hour: 6, minute: 0, dayOfWeek: [0, 1, 2, 3, 4, 5, 6] }, () => {
        console.log('Ejecutando tarea todos los dias a las 6am');
        checkActivity();
    })
}

module.exports = {cronJob, cronJob1, cronJob2}