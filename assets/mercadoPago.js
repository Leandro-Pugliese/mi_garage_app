const mercadopago = require('mercadopago');
const { MercadoPagoConfig } = require("mercadopago");
require("dotenv").config();
const Users = require("../models/User");
const Payments = require("../models/Payments");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { add } = require('date-fns');
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND);

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
                const currentDate = new Date(Date.now());
                const nextExpiryDate = add(currentDate, { months: 1 });
                await Users.updateOne({_id: userId},
                    {
                        $set: {
                            premium: true,
                            premiumExpiration: new Date(nextExpiryDate)
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
            const isPayment = await Payments.findOne({paymentId: data.payment_id});
            if (isPayment) {
                return res.status(403).send("Este id de pago ya fue utilizado.");
            }
            const user = await Users.findOne({_id: data.external_reference});
            if (!user) {
                return res.status(403).send("Usuario no encontrado en la base de datos, porfavor contactar soporte.");
            }
            await Payments.create({
                user: user._id.toString(),
                paymentId: data.payment_id,
                paymentType: data.payment_type,
                paymentDate: new Date(Date.now())
            })
            const currentDate = new Date(Date.now());
            const nextExpiryDate = add(currentDate, { months: 1 });
            await Users.updateOne({_id: data.external_reference},
                {
                    $set: {
                        premium: true,
                        premiumExpiration: new Date(nextExpiryDate)
                    }
                }
            )
            const { error } = await resend.emails.send({
                from: 'Mi Garage <avisosMiGarage@leandro-pugliese.com>',
                to: [user.email],
                subject: 'Membresía premium activada',
                html: ` <strong>¡Hola, este correo es para informarte que tu membresía premium fue activada exitosamente!</strong>
                        <br><strong>Fecha de vencimiento: ${user.vencimientoPremium.toLocaleDateString()}, puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y aprovechar al máximo las funcionalidades tu membresía premium.</strong>
                        <br><p>Si no activaste tu membresía premium o no estas registrado en "Mi Garage", avisa al <a href="http://localhost:3000">STAFF</a> de inmediato.</p>`,
            });
            if (error) {
                console.log(error);
            }
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