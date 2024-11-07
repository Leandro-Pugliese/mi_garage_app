const express = require("express");
const Users = require("../models/User");
const Vehicles = require("../models/Vehicle");
const Activities = require("../models/Activity");
const schedule = require('node-schedule');
const { differenceInDays, subDays, isAfter, isBefore } = require('date-fns');
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND);

const checkKm = async () => {
    try {
        const users = await Users.find({verify: true});
        if (users.length === 0) {
            return
        }
        const vehicles = await Vehicles.find({active: true});
        if (vehicles.length === 0) {
            return
        }
        for (let i=0; i < users.length; i++) {
            const userVehiclesList = vehicles.filter((vehicle) => vehicle.user === users[i]._id.toString());
            for (let x = 0; x < userVehiclesList.length; x++) {
                //Chequeo cuando fue modificado el kilometraje de cada vehículo.
                const updateKmDate = new Date(userVehiclesList[x].updatedKm);
                const currentDate = new Date(Date.now());
                // Calculo la diferencia en días.
                const diffInDays = differenceInDays(currentDate, updateKmDate);
                if ((users[i].premium === true) && (diffInDays >= 7)) {
                    const { error } = await resend.emails.send({
                        from: 'Mi Garage <avisosMiGarage@leandro-pugliese.com>',
                        to: [users[i].email],
                        subject: 'Actualización de kilometraje del vehículo',
                        html: `<strong>Hola, notamos que hace un tiempo no actualizas el kilometraje de tu vehículo patente:${userVehiclesList[x].patente}, 
                                    si estuviste usando tu vehículo puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y actualizar el kilometraje para mantener los avisos al día.</strong>
                                    <br><p>Este es un email automático, no debes responderlo.</p>
                                    <br><p>Si no estas registrado en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
                    });
                    if (error) {
                        console.log(error);
                    }
                } else if (diffInDays >= 30) {
                    const { error } = await resend.emails.send({
                        from: 'Mi Garage <avisosMiGarage@leandro-pugliese.com>',
                        to: [users[i].email],
                        subject: 'Actualización de vehículo',
                        html: `<strong>Hola, notamos que hace un tiempo no actualizas el kilometraje de tu vehículo patente:${userVehiclesList[x].patente}, 
                                    si estuviste usando tu vehículo puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y actualizar el kilometraje para mantener los avisos al día.</strong>
                                    <br><p>Este es un email automático, no debes responderlo.</p>
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

const checkPremium = async () => {
    try {
        const users = await Users.find({verify: true, premium: true});
        if (users.length === 0) {
            return
        }
        for (let i=0; i < users.length; i++) {
            const premiumExpirationDate = new Date(users[i].premiumExpiration);
            const currentDate = new Date(Date.now());
            // Resto 7 días a la fecha de vencimiento.
            const reminderDate = subDays(premiumExpirationDate, 7);
            // Chequeo si falta menos de una semana para el vencimiento y todavia no paso la fecha.
            if (isAfter(currentDate, reminderDate) && isBefore(currentDate, premiumExpirationDate)) {
                const { error } = await resend.emails.send({
                    from: 'Mi Garage <avisosMiGarage@leandro-pugliese.com>',
                    to: [users[i].email],
                    subject: 'Vencimiento membresía premium',
                    html: ` <strong>¡Hola, este correo es para recordarte que se aproxima el vencimiento de tu membresía premium!</strong>
                                <br><strong>Fecha de vencimiento: ${users[i].premiumExpiration.toLocaleDateString()}, puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y renovar tu membresía premium para seguir aprovenchando al máximo las funcionalidades de la app.</strong>
                                <br><p>Si ya renovaste tu membresía premium ignora este email.</p>
                                <br><p>Si no estas registrado en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
                });
                if (error) {
                    console.log(error);
                }
            }
        }
    } catch (error) {
        return console.log(error.message);
    }
}

const checkActivity = async (req, res) => {
    try {
        const users = await Users.find({verify: true});
        if (users.length === 0) {
            return
        }
        const vehicles = await Vehicles.find({active: true});
        if (activities.length === 0) {
            return
        }
        const activities = await Activities.find({active: true});
        if (activities.length === 0) {
            return
        }
        for (let i=0; i < users.length; i++) {
            const activitiesList = activities.filter((activity) => activity.user === users[i]._id.toString());
            for (let x = 0; x < activitiesList.length; x++) {
                    const noticesNumber = activitiesList[x].notices.quantity;
                    const noticesDate = new Date(activitiesList[x].notices.lastNotice) || new Date(Date.now());
                    const currentDate = new Date(Date.now());
                    const DiffAviso = differenceInDays(noticesDate, currentDate);
                    if ((noticesNumber <= 3) && (DiffAviso >= 2)) {
                        //Filtro el vehiculo al cual pertenece la actividad.
                        const vehicle = vehicles.filter((vehicle) => vehicle._id === activitiesList[x].vehicle);
                        if (vehicle.length === 0) {
                            return
                        }
                        //Cargo los datos del vehículo y la actividad.
                        let vehicleKm = null;
                        let expiryKm = null;
                        if (activitiesList[x].nextKm.tiene === true) {
                            vehicleKm = vehicle[0].km || null;
                            expiryKm = activitiesList[x].nextKm.km;
                        }
                        let expiryDate = null;
                        if (activitiesList[x].nextDate.tiene === true) {
                            expiryDate = activitiesList[x].nextDate.date
                        }
                        //Seteo el margen para kilómetros y fechas.
                        const kmMargin = 1000;
                        const daysMargin = 7;
                        // Chequeo de kilómetros
                        let kmAlert = false;
                        if (expiryKm && vehicleKm) {
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
                            msjHtml = `<strong>La actividad: ${activitiesList[x].type} (${activitiesList[x].description}) debe realizarse pronto. 
                                        Debes realizarla cuando el vehículo alcance los ${expiryKm}km o antes del ${expiryDate.toLocaleDateString()} (Tu vehíclo tiene ${vehicleKm}km).</strong>
                                        <br/><p>Si ya realizaste la actividad en tu vehiculo, te pedimos que actualices su estado <a href="http://localhost:3000">INGRESANDO A LA APP</a> para no recibir más esta alerta.</p>`;
                        } else if (kmAlert) {
                            msjHtml = `<strong>La actividad: ${activitiesList[x].type} (${activitiesList[x].description}) debe realizarse pronto. 
                                        Debes realizarla cuando el vehículo alcance los ${expiryKm}km (Tu vehíclo tiene ${vehicleKm}km).</strong>
                                        <br/><p>Si ya realizaste la actividad en tu vehiculo, te pedimos que actualices su estado <a href="http://localhost:3000">INGRESANDO A LA APP</a> para no recibir más esta alerta.<p/>`;
                        } else if (dateAlert) {
                            msjHtml = `<strong>La actividad: ${activitiesList[x].type} (${activitiesList[x].description}) debe realizarse pronto. 
                                        Debes realizarla antes del ${expiryDate.toLocaleDateString()}.</strong>
                                        <br/><p>Si ya realizaste la actividad en tu vehiculo, te pedimos que actualices su estado <a href="http://localhost:3000">INGRESANDO A LA APP</a> para no recibir más esta alerta.<p/>`;
                        }
                        if (msjHtml) {
                            //Envio el correo.
                            const { error } = await resend.emails.send({
                                from: 'Mi Garage <avisosMiGarage@leandro-pugliese.com>',
                                to: [users[i].email],
                                subject: `Realizar ${activitiesList[x].type} al vehículo Dominio: ${vehicle[0].patente}`,
                                html: msjHtml,
                            });
                            if (error) {
                                console.log(error);
                            }
                            if (!error) {
                                await Activities.updateOne({ _id: activitiesList[x]._id },
                                    {
                                        $set: {
                                            notices: {
                                                quantity: noticesNumber + 1,
                                                lastNotice: new Date(Date.now())
                                            }
                                        }
                                    }
                                )
                            }
                        }
                    }
            }
            
        }
    } catch (error) {
        return console.log(error.message);
    }
}

const removePremium = async (req, res) => {
    try {
        const users = await Users.find({premium: true});
        if (users.length === 0) {
            return
        }
        const currentDate = new Date(Date.now());
        for (let i=0; i < users.length; i++) {
            const premiumExpiryDate = new Date(users[i].premiumExpiration);
            if (isBefore(premiumExpiryDate, currentDate)) {
                await Users.updateOne({_id: users[i]._id},
                    {
                        $set: {
                            premium: false,
                            premiumType: "Default"
                        }
                    }
                )
                const { error } = await resend.emails.send({
                    from: 'Mi Garage <avisosMiGarage@leandro-pugliese.com>',
                    to: [users[i].email],
                    subject: 'Membresía premium vencida',
                    html: ` <strong>¡Hola, este correo es para informarte que tu membresía premium venció!</strong>
                            <br><strong>Fecha de vencimiento: ${users[i].premiumExpiration.toLocaleDateString()}, puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y renovar tu membresía premium para seguir aprovenchando al máximo las funcionalidades de la app.</strong>
                            <br><p>Si ya renovaste tu membresía premium o no te interesa tener una, ignora este email.</p>
                            <br><p>Si no estas registrado en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
                });
                if (error) {
                    console.log(error);
                }
                //Bloqueo de vehículos
                const userVehicles = users[i].vehicles;
                if (userVehicles.length > 1) {
                    // Desactivo todos los vehículos excepto el primero.
                    const blockedVehicles = userVehicles.slice(1);
                    await Vehicles.updateMany({_id: {$in: blockedVehicles} },{active: false});
                }
            }
        }
    } catch (error) {
        console.log(error.message);
    }
}

//Cron-job para ejecutarse los miercoles y domingos a las 22hs.
const cronJob = () => {
    schedule.scheduleJob({ hour: 22, minute: 0, dayOfWeek: [0, 3] }, () => {
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
//Cron-job para ejecutarse todos los días a las 4am.
const cronJob3 = () => { 
    schedule.scheduleJob({ hour: 5, minute: 30, dayOfWeek: [0, 1, 2, 3, 4, 5, 6] }, () => {
        console.log('Ejecutando tarea todos los dias a las 5:30am');
        removePremium();
    })
}

module.exports = {cronJob, cronJob1, cronJob2, cronJob3}