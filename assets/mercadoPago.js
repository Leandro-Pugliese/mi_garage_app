const mercadopago = require('mercadopago');
const { MercadoPagoConfig } = require("mercadopago");
require("dotenv").config();
const Users = require("../models/User");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const createPreference = async (req, res) => {
    const token = req.header("Authorization");
    if (!token) {
        return res.status(403).send('No se detecto un token en la petición.')
    }
    const {_id} = jwt.decode(token, {complete: true}).payload
    const userId = _id
    const { email, amount } = req.body;
    const preference = new mercadopago.Preference(new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESTOKEN_PRUEBA }))
    const data = {
        body: {
            items: [
                {
                    title: 'Membresía Premium',
                    quantity: 1,
                    unit_price: parseFloat(amount)
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
        }
    };
    try {
        const response = await preference.create(data);
        const init_point = response.sandbox_init_point || response.init_point;
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
        // Verifico el estado del pago.
        if (paymentData.action === 'payment.created' && paymentData.data.status === 'approved') {
            // Actualiza el usuario a premium
            const userId = paymentData.data.external_reference || paymentData.external_reference;
            const user = await Users.findOne({_id: userId});
            if (user) {
                await Users.updateOne({_id: userId},
                    {
                        $set: {
                            premium: true,
                            vencimientoPremium: new Date(Date.now())
                        }
                    }
                )
            }
        }
        // Respuesta  200 OK para que Mercado Pago sepa que recibi la notificación.
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error al actualizar el usuario:', error);
        return res.status(500).send(error);
    }
}

const paymentRedirect = async (req, res) => {
    try {
        const data = req.query;
        if (data.status === "approved") {
            await Users.updateOne({_id: data.external_reference},
                {
                    $set: {
                        premium: true,
                        vencimientoPremium: new Date(Date.now())
                    }
                }
            )
            return res.status(200).send("Membresía premium activada");
        } else {
            return res.status(403).send("payment status error");
        }
    } catch (error) {
        console.log(error)
        return res.status(500).send("Error al obtener información del pago");
    }
}
module.exports = {createPreference, paymentNotification, paymentRedirect}