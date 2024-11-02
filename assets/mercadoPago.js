const mercadopago = require('mercadopago');
const { MercadoPagoConfig } = require("mercadopago");
require("dotenv").config();
const axios = require('axios');
const Users = require("../models/User");
const Payments = require("../models/Payments");
const Plans = require('../models/plans');
const jwt = require("jsonwebtoken");
const { add } = require('date-fns');
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND);

const createPreference = async (req, res) => {
    const token = req.header("Authorization");
    if (!token) {
        return res.status(403).send('No se detecto un token en la petición.');
    }
    const {_id} = jwt.decode(token, {complete: true}).payload
    const userId = _id
    const { email, planName } = req.body; //Email, planName
    const selectedPlan = await Plans.findOne({name: planName});
    if (!selectedPlan) {
        return res.status(403).send('El plan seleccionado no esta disponible.');
    }
    if (!selectedPlan.description || !selectedPlan.amount) {
        return res.status(403).send('El plan seleccionado no tiene descripción o monto asignados.');
    }
    const preference = new mercadopago.Preference(new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESTOKEN_PRUEBA }))
    const data = {
        body: {
            items: [
                {
                    title: selectedPlan.description,
                    quantity: 1,
                    unit_price: selectedPlan.amount
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
        res.status(200).send({ init_point, response });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Error al crear la preferencia de pago' });
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
                        //Filtro el plan seleccionado por la descripcion para obtener la info (tambien puedo usar el amount)
                        let selectedPlan = await Plans.findOne({description: response.data.description});
                        console.log(selectedPlan);
                        if (!selectedPlan.length) {
                            console.log('Error en el filtrado del plan.');
                            selectedPlan = await Plans.findOne({amount: response.data.transaction_amount});
                            console.log(selectedPlan);
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
                                    premiumType: selectedPlan.type || 'None',
                                    premiumPurchases: userPurchases
                                }
                            }
                        )
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
        // Respuesta  200 OK para que Mercado Pago sepa que recibi la notificación.
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
                return res.status(403).send("Usuario no encontrado en la base de datos, porfavor contactar soporte.");
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
                } else {
                    //Si hay un pago pero fue creado por la notificacion de MP solo lo updeteo por si lo vuelven a usar
                    await Payments.updateOne({paymentId: data.payment_id},
                        {
                            $set: {
                                paymentSource: 'redirect'
                            }
                        }
                    )
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
                    paymentDescription: response.data.description || "-"
                });
            }
            //Filtro el plan seleccionado por la descripcion para obtener la info (tambien puedo usar el amount)
            let selectedPlan = await Plans.findOne({description: response.data.description});
            console.log(selectedPlan)
            if (!selectedPlan) {
                console.log('Error en el filtrado del plan.');
                selectedPlan = await Plans.findOne({amount: response.data.transaction_amount});
                console.log(selectedPlan)
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
            
            //Actualizo el usuario
            await Users.updateOne({_id: data.external_reference},
                {
                    $set: {
                        premium: true,
                        premiumExpiration: new Date(nextExpiryDate),
                        premiumType: selectedPlan.type || 'None',
                        premiumPurchases: userPurchases
                    }
                }
            )
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
        console.log(error)
        return res.status(500).send("Error al obtener información del pago");
    }
}
module.exports = {createPreference, paymentNotification, paymentRedirect}