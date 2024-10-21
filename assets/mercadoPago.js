const mercadopago = require('mercadopago');
const { MercadoPagoConfig } = require("mercadopago");
require("dotenv").config();
const axios = require('axios');
const Users = require("../models/User");
const Payments = require("../models/Payments");
const jwt = require("jsonwebtoken");
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
            notification_url: 'https://9987-190-51-13-12.ngrok-free.app/check/payment' // URL para el webhook
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

//Funcion para chequear datos del pago recibido en el webhook de MP.
const getPaymentDetails = async (paymentId) => {
    console.log('id del pago: ', paymentId)
    try {
      const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESTOKEN_PRUEBA}`
        }
      });
      console.log('Respuesta del pago: ', response.data);
    } catch (error) {
      console.error('Error al obtener el pago:', error.response ? error.response.data : error.message);
    }
};
// const getPaymentDetails = async (paymentId) => {
//     // Inicializo el cliente de Mercado Pago
//     const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESTOKEN_PRUEBA })
    
//     // Creo una instancia de la clase Payment
//     const payment = new mercadopago.Payment(client);
//     console.log('id del pago: ', paymentId)
//     // Consultar un pago por ID
//     payment.get({
//         id: paymentId // El ID del pago que voy a consultar
//     }).then(response => {
//         console.log('Pago obtenido:', response);
//     }).catch(error => {
//         console.error('Error al obtener payment:', error);
//     });
// };

const paymentNotification = async (req, res) => {
    try {
        const paymentData = req.body;
        console.log('Webhook recibido:', paymentData);
        if (paymentData.topic === 'merchant_order') {
            const url = `${paymentData.resource}`;
            axios.get(url, {
            headers: {
                Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESTOKEN_PRUEBA}` // Autorización con el token
            }
            })
            .then(response => {
            console.log('Detalles del pedido:', response.data);
            })
            .catch(error => {
            console.error('Error al obtener el pedido:', error.response ? error.response.data : error.message);
            });
        }
        if (paymentData.data) {
            const paymentId = paymentData.data.id; // El ID que recibes en el webhook
            getPaymentDetails(paymentId);
            // Verifico el estado del pago.
            if (paymentData.action === 'payment.created' && paymentData.data.status === 'approved') {

                // Actualizo el usuario a premium
                const userId = paymentData.data.external_reference || paymentData.external_reference;
                console.log('userId: ', userId);
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
                    // await Payments.create({
                    //     user: user._id.toString(),
                    //     paymentId: data.payment_id,
                    //     paymentType: data.payment_type,
                    //     paymentDate: new Date(Date.now()),
                    //     paymentSource: 'notification'
                    // });
                }
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
            const user = await Users.findOne({_id: data.external_reference});
            if (!user) {
                return res.status(403).send("Usuario no encontrado en la base de datos, porfavor contactar soporte.");
            }
            const isPayment = await Payments.findOne({paymentId: data.payment_id});
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
                    user: user._id.toString(),
                    paymentId: data.payment_id,
                    paymentType: data.payment_type,
                    paymentDate: new Date(Date.now()),
                    paymentSource: 'redirect'
                });
            }
            //Verifico si ya es usuario premium o no
            let nextExpiryDate = null;
            //Si es premium uso la fecha de vencimiento y le agrego un mes
            if (user.premium === true) {
                const expiryDate = new Date(user.premiumExpiration);
                nextExpiryDate = add(expiryDate, { months: 1 });
            } else {
                //Si no es premium agrego un mes desde la fecha del pago
                const currentDate = new Date(Date.now());
                nextExpiryDate = add(currentDate, { months: 1 });
            }
            //Actualizo el usuario
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
                        <br><strong>Fecha de vencimiento: ${new Date(nextExpiryDate).toLocaleDateString()}, puedes <a href="http://localhost:3000">INGRESAR A LA APP</a> y aprovechar al máximo las funcionalidades tu membresía premium.</strong>
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