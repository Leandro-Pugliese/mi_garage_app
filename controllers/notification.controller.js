const express = require("express");
const Notifications = require('../models/Notifications');

const readNotification = async (req, res) => {
    const {id} = req.params; //Id de la notificacion leida.
    try {
        await Notifications.updateOne({_id: id},
            {
                $set: {
                    read: true
                }
            }
        );
        return res.status(200).send('Notificación leida.');
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const deleteNotification = async (req, res) => {
    const {notifications} = req.body; //Array con ids de notificaciones a eliminar.
    try {
        if(notifications.length === 0) {
            return res.status(400).send('No se enviaron ids de notificaciones para eliminar.');
        }
        await Notifications.deleteMany({_id: {$in: notifications}});
        if (notifications.length === 1) {
            return res.status(200).send('Notificación eliminada.')
        } else {
            return res.status(200).send(`Se eliminaron ${notifications.length} notificacones.`)
        }
    } catch (error) {
        return res.status(500).send(error.message);
    }
}


module.exports = {readNotification, deleteNotification}