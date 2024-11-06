const mercadopago = require('mercadopago');
const { MercadoPagoConfig } = require("mercadopago");
require("dotenv").config();
const axios = require('axios');
const Users = require("../models/User");
const Vehicles = require('../models/Vehicle');
const Payments = require("../models/Payments");
const Plans = require('../models/plans');
const jwt = require("jsonwebtoken");
const { add } = require('date-fns');
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND);
const { isBefore, subDays, differenceInDays } = require('date-fns');

const createPreference = async (req, res) => {
    const { email, planName, upgrade } = req.body;
    const token = req.header("Authorization");
    if (!token) {
        return res.status(403).send('No se detecto un token en la petición.');
    }
    const {_id} = jwt.decode(token, {complete: true}).payload
    const userId = _id
    const user = await Users.findOne({_id: userId});
    if (!user) {
        return res.status(403).send('Usuario no encontrado, token inválido.');
    }
    // Si el usuario ya tiene premium y quiere renovar su plan, tiene que ser dentro de los 7 días anteriores a su vencimiento, antes no puede hacerlo.
    if (user.premium && !upgrade) {
        //La fecha de vencimiento tiene que estar dentro de los proximos 7 dias para qeu puedas renovar la membresia
        const premiumExpirationDate = new Date(user.premiumExpiration);
        const currentDate = new Date(Date.now());
        // Resto 7 días a la fecha de vencimiento.
        const checkDate = subDays(premiumExpirationDate, 7);
        // Chequeo si no estoy a 7 días o menos de la fecha de vencimiento.
        if (!(isBefore(currentDate, premiumExpirationDate) && !isBefore(currentDate, checkDate))) {
            const daysRemaining = differenceInDays(premiumExpirationDate, currentDate);
            return res.status(403).send(`Puedes renovar tu plan dentro de los 7 días previos a su vencimiento (días para el vencimiento de tu plan: ${daysRemaining}).`); 
        }
    }
    const selectedPlan = await Plans.findOne({name: planName});
    if (!selectedPlan) {
        return res.status(403).send('El plan seleccionado no esta disponible.');
    }
    if (!selectedPlan.description || !selectedPlan.amount) {
        return res.status(403).send('El plan seleccionado no tiene descripción o monto asignados.');
    }
    let planAmount = selectedPlan.amount;
    let planDescription = selectedPlan.description;
    // Upgrade de plan
    if (user.premium && upgrade) {
        //Calculo lso dias restantes del plan actual
        const upgradeDays = differenceInDays(premiumExpirationDate, currentDate);
        console.log(upgradeDays, typeof upgradeDays);
        if (upgradeDays <= 0) {
            return res.status(403).send('No te quedan días restantes para mejorar tu plan, puedes contratar el plan qeu desees.');
        }
        const currentPlan = await Plans.findOne({type: user.premiumType});
        if (!currentPlan) {
            return res.status(403).send('No es posible hacer el upgrade, ya que tu plan actual no esta disponible al dia de hoy, tienes que esperar el vencimiento para contratar el plan que desees.');
        }
        // Calculo el credito que le queda al usuario de su plan actual, y lo resto al nuevo plan
        const costPerDay =  currentPlan.amount / 30;
        const remainingCredit = costPerDay * upgradeDays; 
        const remainingAmount = planAmount - remainingCredit 
        //Sumo el monto restante del upgrade al percio de otro mes completo de premium.
        planAmount = selectedPlan.amount + remainingAmount;
        // Agrego string para identificar que es un upgrade
        const upgradeText = ' + upgrade plan Basic a Plus';
        planDescription = selectedPlan.description + upgradeText;
    }
    const preference = new mercadopago.Preference(new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESTOKEN_PRUEBA }))
    const data = {
        body: {
            items: [
                {
                    title: planDescription,
                    quantity: 1,
                    unit_price: planAmount
                },
            ],
            payer: {
                email: email //Este es el email de la cuenta de prueba comprador.
            },
            external_reference: userId, //ID para actualizar el usuario si el pago es aprobado.
            back_urls: {
                success: `https://www.leandro-pugliese.com`,
                failure: 'https://cambio-hoy.vercel.app',
                pending: 'https://easy-qr-generator-chi.vercel.app'
            },
            auto_return: 'approved',
            notification_url: 'https://e8bb-190-51-9-137.ngrok-free.app/check/payment' // URL para el webhook
        }
    };
    try {
        const response = await preference.create(data);
        const init_point = response.init_point || response.sandbox_init_point;
        return res.status(200).send({ init_point, response });
    } catch (error) {
        console.error(error);
        return res.status(500).send({ error: 'Error al crear la preferencia de pago' });
    }
}

const paymentNotification = async (req, res) => {
    try {
        const paymentData = req.body;
        console.log('Webhook recibido:', paymentData);
        //Chequeo en el webhook la data del pago
        if (paymentData.data) {
            const paymentId = paymentData.data.id; // El ID que recibo en el webhook
            console.log('Id del pago: ', paymentId)
            try {
                const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESTOKEN_PRUEBA}`
                    }
                });
                console.log('Respuesta del pago: ', response.data);
                console.log('Status del pago: ', response.data.status);
                console.log('External reference del pago: ', response.data.external_reference);
                console.log('ID del pago: ', response.data.id);
                console.log('Moneda del pago: ', response.data.currency_id);
                console.log('Descripción del pago: ', response.data.description);
                console.log('Forma de pago: ', response.data.payment_type_id);
                console.log('Total del pago: ', response.data.transaction_amount, typeof response.data.transaction_amount);
                // Verifico el estado del pago.
                if (response.data.status === 'approved') {
                    // Actualizo el usuario a premium
                    const userId = response.data.external_reference;
                    console.log('userId: ', userId);
                    const user = await Users.findOne({_id: userId});
                    if (user) {
                        let mainDescription = response.data.description
                        //si es pago de upgrade, separo la parte del string de descripcion que dice el upgrade para poder buscar el plan
                        if (response.data.description.includes('+')) {
                            const description = response.data.description;
                            mainDescription = description.split(' +')[0].trim(); //.trim() elimina cualquier espacio en blanco extra al final de la primera parte. 
                        }
                        //Filtro el plan seleccionado por la descripcion para obtener la info.
                        let selectedPlan = await Plans.findOne({description: mainDescription});
                        console.log(selectedPlan);
                        if (!selectedPlan.length) {
                            console.log('Error en el filtrado del plan.');
                        }
                        const userPurchases = [...user.premiumPurchases];
                        userPurchases.push(selectedPlan.name || "Compra premium");
                        //Verifico si ya es usuario premium o no
                        let nextExpiryDate = null;
                        //Si es premium uso la fecha de vencimiento y le agrego los meses del plan comprado
                        const paidMonths = selectedPlan.months || 1
                        if (user.premium === true) {
                            const expiryDate = new Date(user.premiumExpiration);
                            nextExpiryDate = add(expiryDate, { months: paidMonths });
                        } else {
                            //Si no es premium agrego un mes desde la fecha del pago
                            const currentDate = new Date(Date.now());
                            nextExpiryDate = add(currentDate, { months: paidMonths });
                        }
                        //Actualizo el usuario
                        await Users.updateOne({_id: userId},
                            {
                                $set: {
                                    premium: true,
                                    premiumExpiration: new Date(nextExpiryDate),
                                    premiumType: selectedPlan.type || 'Error',
                                    premiumPurchases: userPurchases
                                }
                            }
                        )
                        //Veo cuantos vehículos activar según el plan abonado
                        const maxActiveVehicles = user.premiumType === 'Basic' ? 3 : user.vehicles.length;
                        // Activo los vehículos 
                        await Promise.all(
                            user.vehicles.map((vehicle, index) => {
                                const isActive = index < maxActiveVehicles; // Activo según el límite del plan
                                return Vehicles.findByIdAndUpdate(vehicle, { active: isActive });
                            })
                        );
                        //Creo el payment 
                        const isPayment = await Payments.findOne({paymentId: response.data.id})
                        if (!isPayment) {
                            await Payments.create({
                                user: userId,
                                paymentId: response.data.id,
                                paymentType: response.data.payment_type_id,
                                paymentDate: new Date(Date.now()),
                                paymentSource: 'notification',
                                paymentAmount: response.data.transaction_amount,
                                paymentDescription: response.data.description
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error al obtener el pago:', error.response ? error.response.data : error.message);
            }
        }
        // Respuesta 200 OK para que Mercado Pago sepa que recibi la notificación.
        return res.status(200).send('OK');
    } catch (error) {
        console.error('Error al actualizar el usuario:', error);
        return res.status(500).send(error);
    }
}

const paymentRedirect = async (req, res) => {
    try {
        const data = req.query;
        if (data.status === "approved") {
            const user = await Users.findOne({_id: data.external_reference});
            if (!user) {
                return res.status(403).send("Usuario no encontrado en la base de datos, porfavor contacta a soporte con este código de error: UNE1");
            }
            const isPayment = await Payments.findOne({paymentId: data.payment_id});
            try {
                const response = await axios.get(`https://api.mercadopago.com/v1/payments/${data.payment_id}`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESTOKEN_PRUEBA}`
                    }
                });
                console.log('Respuesta del pago: ', response.data);
                console.log('Status del pago: ', response.data.status);
                console.log('External reference del pago: ', response.data.external_reference);
                console.log('ID del pago: ', response.data.id);
                console.log('Moneda del pago: ', response.data.currency_id);
                console.log('Descripción del pago: ', response.data.description);
                console.log('Forma de pago: ', response.data.payment_type_id);
                console.log('Total del pago: ', response.data.transaction_amount);
            } catch (error) {
                console.error('Error al obtener el pago:', error.response ? error.response.data : error.message);
            }
            //Verifico si existe un pago registrado con ese id
            if (isPayment) {
                //Si hay un pago y ya fue redireccionado, lo freno
                if (isPayment.paymentSource === 'redirect') {
                    return res.status(403).send("Este id de pago ya fue utilizado.");
                }
            } else {
                //Si no hubo pago registrado todavia por notificacion de MP, creo el pago.
                await Payments.create({
                    user: data.external_reference,
                    paymentId: data.payment_id,
                    paymentType: data.payment_type,
                    paymentDate: new Date(Date.now()),
                    paymentSource: 'redirect',
                    paymentAmount: response.data.transaction_amount || 0,
                    paymentDescription: response.data.description || "error"
                });
            }
            //Filtro el plan seleccionado por la descripcion para obtener la info
            let mainDescription = response.data.description
            //si es pago de upgrade, separo la parte del string de descripcion que dice el upgrade para poder buscar el plan
            if (response.data.description.includes('+')) {
                const description = response.data.description;
                mainDescription = description.split(' +')[0].trim(); //.trim() elimina cualquier espacio en blanco extra al final de la primera parte. 
            }
            let selectedPlan = await Plans.findOne({description: mainDescription});
            if (!selectedPlan) {
                console.log('Error en el filtrado del plan.');
            }
            const userPurchases = [...user.premiumPurchases];
            userPurchases.push(selectedPlan.name || "Compra premium");
            const paidMonths = selectedPlan.months || 1
            //Verifico si ya es usuario premium o no
            let nextExpiryDate = null;
            //Si es premium uso la fecha de vencimiento y le agrego un mes
            if (user.premium === true) {
                const expiryDate = new Date(user.premiumExpiration);
                nextExpiryDate = add(expiryDate, { months: paidMonths });
            } else {
                //Si no es premium agrego un mes desde la fecha del pago
                const currentDate = new Date(Date.now());
                nextExpiryDate = add(currentDate, { months: paidMonths });
            }
            //Actualizo el usuario si no fue modificado con el webhook
            if (expiryDate !== nextExpiryDate) { //Chequeo si la fecha es la misma que me da actualizando al usuario quiere decir que ya fue actualizado
                await Users.updateOne({_id: data.external_reference},
                    {
                        $set: {
                            premium: true,
                            premiumExpiration: new Date(nextExpiryDate),
                            premiumType: selectedPlan.type || 'Error',
                            premiumPurchases: userPurchases
                        }
                    }
                )
                //Veo cuantos vehículos activar según el plan abonado
                const maxActiveVehicles = user.premiumType === 'Basic' ? 3 : user.vehicles.length;
                // Activo los vehículos 
                await Promise.all(
                    user.vehicles.map((vehicle, index) => {
                        const isActive = index < maxActiveVehicles; // Activo según el límite del plan
                        return Vehicles.findByIdAndUpdate(vehicle, { active: isActive });
                    })
                );
            }
            const { error } = await resend.emails.send({
                from: 'Mi Garage <avisosMiGarage@leandro-pugliese.com>',
                to: [user.email],
                subject: 'Membresía premium activada',
                html: ` <strong>¡Hola, este correo es para informarte que tu membresía premium fue activada exitosamente!</strong>
                        <br><strong>Fecha de vencimiento: ${new Date(nextExpiryDate).toLocaleDateString()}, puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y aprovechar al máximo las funcionalidades tu membresía premium.</strong>
                        <br><p>Si no activaste tu membresía premium o no estas registrado en "Mi Garage", avisa al <a href="http://localhost:3000">STAFF</a> de inmediato.</p>`,
            });
            if (error) {
                console.log(error);
            }
            return res.status(200).send("Membresía premium activada");
        } else {
            return res.status(403).send("Payment status error");
        }
    } catch (error) {
        console.log(error);
        return res.status(500).send("Error al obtener información del pago, porfavor contacta a soporte.");
    }
}

module.exports = {createPreference, paymentNotification, paymentRedirect}