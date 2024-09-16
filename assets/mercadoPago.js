const mercadopago = require('mercadopago');
const { MercadoPagoConfig } = require("mercadopago");
require("dotenv").config();
const Users = require("../models/User");
const jwt = require("jsonwebtoken");

// Configuración de credenciales.
// mercadopago.configurations.setAccessToken(process.env.MERCADOPAGO_ACCESTOKEN_PRUEBA);
// const client = new MercadoPagoConfig({
//     access_token: process.env.MERCADOPAGO_ACCESTOKEN_PRUEBA
// });
// mercadopago.configurations = new mercadopago.MercadoPagoConfig({
//     access_token: process.env.MERCADOPAGO_ACCESTOKEN_PRUEBA
// });

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
                success: 'https://leandro-pugliese.com',
                failure: 'https://cambio-hoy.vercel.app',
                pending: 'https://easy-qr-generator-chi.vercel.app'
            },
            auto_return: 'approved',
        }
    };
    try {
        const response = await preference.create(data);
        const init_point = response.sandbox_init_point || response.init_point;
        res.status(200).send({ init_point });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Error al crear la preferencia de pago' });
    }
}

const paymentNotification = async (req, res) => {
    try {
        const payment = req.body;
        // Verifico si el pago fue exitoso.
        if (payment.type === 'payment' && payment.data.status === 'approved') {
            const userId = payment.data.external_reference;  // Identifico al usuario con `external_reference`
            console.log(userId)
            // Update usuario a premium.
            await Users.updateOne({_id: userId},
                {
                    $set: {
                        premium: true
                    }
                }
            )
            return res.status(200).send('Usuario actualizado a premium');
        } else {
            return res.status(400).send('Pago no aprobado');
        } 
    } catch (error) {
        console.error('Error al actualizar el usuario:', error);
        return res.status(500).send('Error al actualizar el usuario');
    }
}
module.exports = {createPreference, paymentNotification}