const express = require("express");
const Users = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND);

//Firma del token.
const signToken = (_id, email) => jwt.sign({_id, email}, process.env.JWT_CODE);

const createUser = async (req, res) => {
    const {body} = req; //email, pais, provincia, localidad, password
    try {
        const emailUser = body.email.toLowerCase();
        const isUser = await Users.findOne({email: emailUser});
        if (isUser) {
            return res.status(403).send("El email ingresado pertenece a un usuario ya registrado.");
        }
        const salt = await bcrypt.genSalt();
        const hashed = await bcrypt.hash(body.password, salt);
        const user = await Users.create({
            email: emailUser,
            verificado: false,
            premium: false,
            vencimientoPremium: new Date(Date.now()),
            vehiculos: [],
            ingresos: 0,
            ultimaConexion: new Date(Date.now()),
            pais: body.pais,
            provincia: body.provincia,
            localidad: body.localidad,
            password: hashed, salt
        })
        const token = signToken(user._id, user.email);
        const msj = "Usuario creado exitosamente."
        return res.status(200).send({token, user, msj});
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const loginUser = async (req, res) => {
    const {body} = req; //Email, password
    try {
        const emailUser = body.email.toLowerCase();
        const user = await Users.findOne({email: emailUser})
        if (!user) {
            return res.status(403).send("El email y/o la contraseña son incorrectos.")
        } 
        const isMatch = await bcrypt.compare(body.password, user.password);
        if (isMatch) {
            await Users.updateOne({ _id: user._id },
                {
                    $set: {
                        ingresos: user.ingresos + 1,
                        ultimaConexion: new Date(Date.now())
                    }
                }
            );
            const token = signToken(user._id, user.email);
            return res.status(200).send({token, user});
        }
        return res.status(403).send("El email y/o la contraseña son incorrectos.");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const userData = async (req, res) => {
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
        return res.status(200).send(user);
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const updateUser = async (req, res) => {
    const {body} = req; //pais, provincia, localidad.
    try {
        const token = req.header("Authorization");
        if (!token) {
            return res.status(403).send('No se detecto un token en la petición.');
        }
        const {email} = jwt.decode(token, {complete: true}).payload;
        const user = await Users.findOne({email: email})
        if (!user) {
            return res.status(403).send("Credenciales inválidas.");
        }
        await Users.updateOne({email: email},
            {
                $set: {
                    pais: body.pais,
                    provincia: body.provincia,
                    localidad: body.localidad
                }
            }
        )
        return res.status(200).send('Datos modificados exitosamente.');
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const updatePassword = async (req, res) => {
    const {body} = req; //PasswordActual, passwordNueva
    try {
        const token = req.header("Authorization");
        if (!token) {
            return res.status(403).send('No se detecto un token en la petición.');
        }
        const {email} = jwt.decode(token, {complete: true}).payload;
        const user = await Users.findOne({email: email})
        if (!user) {
            return res.status(403).send("Credenciales inválidas.");
        }
        const isMatch = await bcrypt.compare(body.passwordActual, user.password);
        if (!isMatch) {
            return res.status(403).send("Contraseña actual inválida.");
        }
        const salt = await bcrypt.genSalt();
        const hashed = await bcrypt.hash(body.passwordNueva, salt);
        await Users.updateOne({email: email},
            {
                $set: {
                    password: hashed, salt
                }
            }
        )
        return res.status(200).send('Contraseña modificada exitosamente.');
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const sendEmailValidation = async (req, res) => {
    try {
        const token = req.header("Authorization");
        if (!token) {
            return res.status(403).send('No se detecto un token en la petición.')
        }
        const {_id} = jwt.decode(token, {complete: true}).payload;
        const user = await Users.findOne({_id: _id});
        if (!user) {
            return res.status(403).send("Usuario no encontrado, token inválido.");
        }
        if (user.verificado === true) {
            return res.status(403).send("Tu email ya fue verificado.");
        }
        const payload = {
            id:user._id
        }
        const nuevoToken = jwt.sign(payload, process.env.JWT_CODE, {expiresIn: '10m'});
        const link = `${user._id}/${nuevoToken}`;
        const { error } = await resend.emails.send({
            from: 'Mi Garage <soporteMiGarage@leandro-pugliese.com>',
            to: [user.email],
            subject: 'Verificación de Correo Mi Garage',
            html: ` <strong>Ingresa en el siguiente link para verificar tu correo: <a href="http://localhost:3000/validation/${link}">Click Aqui</a></strong>
                    <br><p>Si no te registraste en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
        });
        if (error) {
            return res.status(403).send(error);
        }
        return res.status(200).send("Enviamos un email para verificar tu correo.");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const emailValidation= async (req, res) => {
    const {id, token} = req.params
    try {
        jwt.verify(token, process.env.JWT_CODE);
        const user = await Users.findOne({_id: id})
        if (!user) {
            return res.status(403).send("Usuario no encontrado, volvé a intentarlo o comunicate con soporte.");
        }
        await Users.updateOne({_id: id},
            {
                $set: {
                   verificado: true
                }
            }
        )
        return res.status(200).send("Correo verificado exitosamente.");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const forgotPassword = async (req, res) => {
    const {body} = req; //Email
    try {
        const emailUser = body.email.toLowerCase();
        const user = await Users.findOne({email: emailUser});
        if (!user) {
            return res.status(403).send("No hay un usuario registrado con el email ingresado.");
        }
        const payload = {
            id:user._id
        }
        const nuevoToken = jwt.sign(payload, process.env.JWT_CODE, {expiresIn: '10m'});
        const link = `${user._id}/${nuevoToken}`;
        const { error } = await resend.emails.send({
            from: 'Mi Garage <soporteMiGarage@leandro-pugliese.com>',
            to: [emailUser],
            subject: 'Restablecer contraseña Mi Garage',
            html: ` <strong>Ingresa en el siguiente link para restablecer tu contraseña: <a href="http://localhost:3000/recuperar-password/${link}">Click Aqui</a></strong>
                    <br><p>¡Si no pediste el restablecer la contraseña ignora este email y avisa al staff de inmediato!</p>`,
        });
        if (error) {
            return res.status(403).send(error);
        }
        return res.status(200).send("Enviamos un link a tu email para que puedas recuperar la contraseña, recordá verificar la casilla de spam si no encuentras el email.")
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const resetPassword = async (req, res) => {
    const {body} = req; //passwordNueva
    const {id, token} = req.params
    try {
        const user = await Users.findOne({_id: id});
        if (!user) {
            return res.status(403).send("Credenciales inválidas.");
        }
        jwt.verify(token, process.env.JWT_CODE);
        const salt = await bcrypt.genSalt();
        const hashed = await bcrypt.hash(body.passwordNueva, salt);
        await Users.updateOne({_id: id},
            {
                $set: {
                    password: hashed, salt
                }
            }
        )
        return res.status(200).send('Contraseña restablecida exitosamente.');
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

module.exports = { createUser, loginUser, userData, updateUser, updatePassword, sendEmailValidation, 
                   emailValidation, forgotPassword, resetPassword }