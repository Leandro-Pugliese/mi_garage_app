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
            const userVehiclesList = users[i].vehiculos
            console.log(userVehiclesList, userVehiclesList.length)
            for (let x=0; x < userVehiclesList.length; x++) {
                const vehicle = await Vehicles.findOne({_id: id});
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
                                html: ` <strong>Hola, hace un tiempo que no actualizas el kilometraje de tu vehículo patente:${vehicles[i].patente}, si usaste tu vehículo puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y actualizar el kilometraje para mantener los avisos al día.</strong>
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
                                html: ` <strong>Hola, hace un tiempo que no actualizas el kilometraje de tu vehículo patente:${vehicles[i].patente}, si usaste tu vehículo puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y actualizar el kilometraje para mantener los avisos al día.</strong>
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
            if (users[i].premium === true) {
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
                        html: ` <strong>¿Hola, este correo es para recordarte que se aproxima el vencimiento de tu membresía premium!</strong>
                                <br><strong>Fecha de vencimiento: ${users[i].vencimientoPremium}, puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y renovar tu membresía premium para seguir aprovenchando al máximo las funcionalidades de la app.</strong>
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

// Cron-job para ejecutarse los miercoles y domingos a las 18hs.
schedule.scheduleJob({ hour: 18, minute: 0, dayOfWeek: [0, 3] }, () => {
    console.log('Ejecutando tarea del miercoles/domingo a las 18:00hs');
    checkKm();
});

// Cron-job para ejecutarse todos los días a la medianoche.
schedule.scheduleJob({ hour: 0, minute: 0, dayOfWeek: [0, 1, 2, 3, 4, 5, 6] }, () => {
    console.log('Ejecutando tarea todos los dias a la medianoche');
    checkPremium();
  });