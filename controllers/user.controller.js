const express = require("express");
const Users = require("../models/User");
const Activities = require("../models/Activity");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND);

//Firma del token.
const signToken = (_id, email) => jwt.sign({_id, email}, process.env.JWT_CODE);

const createUser = async (req, res) => {
    const {body} = req; //email, country, province, phone, password
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
            verify: false,
            premium: false,
            premiumExpiration: new Date(Date.now()),
            vehicles: [],
            categories: ["MANTENIMIENTO", "SEGURO", "VERIFCACIÓN TÉCNICA", "PATENTE", "GNC", "OTROS"],
            entries: 0,
            lastConection: new Date(Date.now()),
            country: body.country,
            province: body.province,
            phone: body.phone || 0,
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
                        entries: user.entries + 1,
                        lastConection: new Date(Date.now())
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
    const {body} = req; //country, province, phone.
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
                    country: body.country || user.country,
                    province: body.province || user.province,
                    phone: body.phone || user.phone
                }
            }
        )
        return res.status(200).send('Datos modificados exitosamente.');
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const updatePassword = async (req, res) => {
    const {body} = req; //oldPassword, newPassword
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
        const isMatch = await bcrypt.compare(body.oldPassword, user.password);
        if (!isMatch) {
            return res.status(403).send("Contraseña actual inválida.");
        }
        const salt = await bcrypt.genSalt();
        const hashed = await bcrypt.hash(body.newPassword, salt);
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

const updateCategories = async (req, res) => {
    const {body} = req; //operation("ADD"/"REMOVE"), category.
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
        let categorias = [...user.categories];
        let msj = '';
        if (body.operation === "ADD") {
             // Chequeo que no este repetida la categoría.
             if (categorias.includes(body.category) === true) {
                return res.status(403).send("La categoría ya esta registrada.");
            }
            // Agrego la categoría ingresada.
            categorias.push(body.category);
            msj = "Categoría agregada exitosamente."
        } else if (body.operation === "REMOVE") {
            // Tengo que chequear si esa categoría no se utiliza en alguna actividad antes de borrarla.
            const activities = await Activities.find({user: user._id});
            // Filtro las actividades del usuario con la categoría que quiere eliminar.
            const categoriaUtilizada = activities.filter((activity) => activity.type === body.category);
            if (categoriaUtilizada.length >= 1) { // Si hay al menos una actividad con esa categoría no la podes borrar.
                return res.status(403).send("No es posible eliminar esta categoría porque hay actividades en la base de datos que pertenecen a la misma, modifica la categoría de esas actividades para poder eliminarla.");
            }
            //Chequeo si solo queda una categoria, obligo al usuario a crear otra antes de eliminarla, para que no quede vacia la lista.
            if (categorias.length === 1) {
                return res.status(403).send("Debes tener al menos una categoría para poder cargar actividades, para eliminar esta última debes crear otra primero.")
            }
            // En caso de que se pueda borrar, la quitamos de la lista.
            for (let indice in categorias){
                let categoriaOriginal = categorias[indice];
                if (categoriaOriginal === body.category) {
                    categorias.splice(indice, 1);
                }
            }
            msj = 'Categoría eliminada exitosamente.'
        } else {
            return res.status(403).send("Tipo de operación no definido.");
        }
        // Hago el update del usuario con las categorias modificadas.
        await Users.updateOne({_id: user._id},
            {
                $set: {
                    categories: categorias
                }
            }
        )
        return res.status(200).send(msj);
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
        if (user.verify === true) {
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
            subject: 'Verificación de Correo',
            html: ` <strong>Ingresa en el siguiente link para verificar tu correo: <a href="http://localhost:3000/user/${link}">Click Aqui</a></strong>
                    <br><p>Este es un email automático, no debes responderlo.</p>       
                    <br><p>Si no te registraste en "Mi Garage" ignora este email y avisa al staff de inmediato.</p>`,
        });
        if (error) {
            console.log(error)
            return res.status(403).send("Error al enviar el email.");
        }
        return res.status(200).send("Enviamos un email para verificar tu correo.");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const emailValidation= async (req, res) => {
    const {id, token} = req.params;
    try {
        jwt.verify(token, process.env.JWT_CODE);
        const user = await Users.findOne({_id: id})
        if (!user) {
            return res.status(403).send("Usuario no encontrado, volvé a intentarlo o comunicate con soporte.");
        }
        await Users.updateOne({_id: id},
            {
                $set: {
                   verify: true
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
            html: ` <strong>Ingresa en el siguiente link para restablecer tu contraseña: <a href="http://localhost:3000/user/forgotPassword/${link}">Click Aqui</a></strong>
                    <br><p>¡Si no pediste el restablecer la contraseña ignora este email y avisa al staff de inmediato!</p>`,
        });
        if (error) {
            return res.status(403).send("Error al enviar el email.");
        }
        return res.status(200).send("Enviamos un link a tu email para que puedas recuperar la contraseña, recordá verificar la casilla de spam si no encuentras el email.")
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const resetPassword = async (req, res) => {
    const {body} = req; //password
    const {token} = req.params
    try {
        jwt.verify(token, process.env.JWT_CODE);
        const {id} = jwt.decode(token, {complete: true}).payload
        const user = await Users.findOne({_id: id})
        if (!user) {
            //Lo devuevlo en formato objeto para poder usar todo igual en el front, el jwt.verify devuelve con ese formato el error.
            return res.status(403).send("Usuario no encontrado, volvé a intentarlo o comunicate con soporte.");
        }
        const salt = await bcrypt.genSalt();
        const hashed = await bcrypt.hash(body.password, salt);
        await Users.updateOne({_id: user._id},
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

const sendDeleteVerifcation = async (req, res) => {
    const {body} = req; //password
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
        if (user.verify !== true) {
            return res.status(403).send("Tienes que tener tu correo verificado para poder enviar la solicitud.");
        }
        if (user.premium === true) {
            return res.status(403).send("Para eliminar una cuenta que tiene premium activo debes comunicarte con soporte.");
        }
        const isMatch = await bcrypt.compare(body.password, user.password);
        if (!isMatch) {
            return res.status(403).send("Contraseña inválida.");
        }
        const payload = {
            _id:user._id
        }
        const nuevoToken = jwt.sign(payload, process.env.JWT_CODE, {expiresIn: '10m'});
        const link = `${user._id}/${nuevoToken}`;
        const { error } = await resend.emails.send({
            from: 'Mi Garage <soporteMiGarage@leandro-pugliese.com>',
            to: [user.email],
            subject: 'Eliminar cuenta',
            html: ` <strong>Ingresa en el siguiente link para eliminar tu cuenta: <a href="http://localhost:3000/user/delete/${link}">Click Aqui</a></strong>
                    <br><p>Si no solicitaste eliminar tu cuenta, te recomendamos ignorar este email, cambiar tu contraseña y avisar al staff de inmediato.</p>
                    <br><p>Este es un email automático, no debes responderlo.</p>`,
        });
        if (error) {
            console.log(error)
            return res.status(403).send("Error al enviar el email.");
        }
        return res.status(200).send("Te enviamos un email con la verificación para eliminar tu cuenta.");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const deleteUser= async (req, res) => {
    const {token} = req.params;
    try {
        jwt.verify(token, process.env.JWT_CODE);
        const {_id} = jwt.decode(token, {complete: true}).payload
        const user = await Users.findOne({_id: _id})
        if (!user) {
            //Lo devuevlo en formato objeto para poder usar todo igual en el front, el jwt.verify devuelve con ese formato el error.
            return res.status(403).send({message: "Usuario no encontrado, volvé a intentarlo o comunicate con soporte."});
        }
        await Users.deleteOne({_id: _id});
        const { error } = await resend.emails.send({
            from: 'Mi Garage <soporteMiGarage@leandro-pugliese.com>',
            to: [user.email],
            subject: 'Cuenta eliminada',
            html: ` <strong>Tu cuenta fue eliminada exitosamente, si alguna vez quieres volver a usar la app tendras que crear una nueva.</strong>
                    <br><p>Si no solicitaste eliminar tu cuenta porfavor comunicate con <a href="http://localhost:3000">soporte</a> de inmediato.</p>
                    <br><p>Este es un email automático, no debes responderlo.</p>`,
        });
        if (error) {
            console.log(error, user.email)
        }
        return res.status(200).send("Cuenta eliminada con éxito.");
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

module.exports = { createUser, loginUser, userData, updateUser, updatePassword, updateCategories, sendEmailValidation, 
                   emailValidation, forgotPassword, resetPassword, sendDeleteVerifcation, deleteUser }