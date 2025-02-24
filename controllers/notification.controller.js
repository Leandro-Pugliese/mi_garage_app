const express = require("express");
const Notifications = require('../models/Notifications');

const readNotification = async (req, res) => {
    const {notificationsList} = req.body; //Array con IDs de las notificacines leidas.
    try {
        if (!Array.isArray(notificationsList) || notificationsList.length === 0) {
            return res.status(400).send("Debe proporcionar una lista de notificaciones.");
        }
        const result = await Notifications.updateMany({_id: {$in: notificationsList}},
            {
                $set: {
                    read: true
                }
            }
        );
        if (result.modifiedCount === 0) {
            return res.status(404).send("No se encontraron notificaciones para actualizar.");
        }
        return res.status(200).send(
            notificationsList.length === 1 ? "Notificación leída." : "Notificaciones leídas."
        );
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const deleteNotification = async (req, res) => {
    const {selectedForDeletion} = req.body; //Array con ids de notificaciones a eliminar.
    try {
        if(selectedForDeletion.length === 0) {
            return res.status(400).send('No se enviaron ids de notificaciones para eliminar.');
        }
        await Notifications.deleteMany({_id: {$in: selectedForDeletion}});
        // Emisión de eventos con websocket para actaulizar notificaciones en tiempo real.
        const socket = require("../socket").getIO();
        // Emito el evento al usuario que envió la transferencia
        socket.to(req.user._id.toString()).emit("newNotification", {
            message: 'Nueva notificación recibida'
        });
        if (selectedForDeletion.length === 1) {
            return res.status(200).send('Notificación eliminada.')
        } else {
            return res.status(200).send(`Se eliminaron ${selectedForDeletion.length} notificacones.`)
        }
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

const getNotifications = async (req, res) => {
    try {
        //console.log(req.user)
        const notifications = await Notifications.find({user: req.user._id})
        .sort({date: -1})
        //.limit(10); por ahora no las voy a limitar
        return res.status(200).send(notifications)
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

module.exports = {readNotification, deleteNotification, getNotifications}