const express = require("express");
const Users = require("../models/User");
const jwt = require("jsonwebtoken");

const readNotification = async (req, res) => {
    try {
        const {id} = req.params;
        const token = req.header("Authorization");
        if (!token) {
            return res.status(403).send('No se detecto un token en la petición.')
        }
        const {_id} = jwt.decode(token, {complete: true}).payload
        await Users.updateOne({_id: _id},
            { 
                $pull: { notifications: { id: id } } 
            }
        );
        return res.status(200).send('Notificación marcada como leida.')
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const deleteNotification = async (req, res) => {
    try {
        const {id} = req.params;
        const token = req.header("Authorization");
        if (!token) {
            return res.status(403).send('No se detecto un token en la petición.')
        }
        const {_id} = jwt.decode(token, {complete: true}).payload
        const result = await Users.updateOne({_id: _id},
            { 
                $pull: { notifications: { id: id } } 
            }
        );
        if (result.nModified === 0) { //Con esto me fijo si la notificacion se actualizo o si no actualizo nada
            return res.status(404).send('Notificación no encontrada');
        }
        return res.status(200).send('Notificación eliminada')
    } catch (error) {
        return res.status(500).send(error.message);
    }
}


module.exports = {readNotification, deleteNotification}