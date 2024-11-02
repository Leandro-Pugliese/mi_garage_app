const express = require("express");
const Users = require("../models/User");
const Reminders = require('../models/Reminder');
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND);


const createReminder = async (req, res) => {
    const {type, vehicle, category, description, km, date, notices} = req.body;
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
        await Reminders.create({
            type: type,
            user: user._id.toString(),
            vehicle: vehicle,
            category: category,
            description: description,
            km: km,
            date: date,
            notices: notices
        })
        return res.status(200).send('Recordatorio creado exitosamente');
    } catch (error) {
        console.log(error);
        return res.status(500).send(error.message);
    }
}

const reminderData = async (req, res) => { 
    try {
        const {id} = req.params;
        const reminder = await Reminders.findOne({_id: id})
        if (!reminder) {
            return res.status(403).send("Recordatorio no encontrado.");
        }
        return res.status(200).send(reminder);
    } catch (error) {
        console.log(error);
        return res.status(500).send(error.message);
    }
}

const updateReminder = async (req, res) => {
    try {
        const {id} = req.params;
        const {type, category, description, km, date, notices, active} = req.body;
        const reminder = await Reminders.findOne({_id: id})
        if (!reminder) {
            return res.status(403).send("Recordatorio no encontrado.");
        }
        await Reminders.updateOne({_id: id},{
            $set: {
                type: type || reminder.type,
                category: category || reminder.category,
                description: description || reminder.description,
                km: km || reminder.km,
                date: date || reminder.date,
                notices: notices || reminder.notices,
                active: active || reminder.active
            }
        })
        return res.status(201).send('Recordatorio modificado.');
    } catch (error) {
        console.log(error);
        return res.status(500).send(error.message);
    }
}

const deleteReminder = async (req, res) => {
    try {
        const {id} = req.params;
        await Reminders.deleteOne({_id: id});
        return res.status(200).send('Recordatorio eliminado.');
    } catch (error) {
        console.log(error);
        return res.status(500).send(error.message);
    }
}

const remindersList = async (req, res) => {
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
        const reminders = await Reminders.find({user: user._id.toString()})
        return res.status(200).send(reminders);
    } catch (error) {
        console.log(error);
        return res.status(500).send(error.message);
    }
}


module.exports = {createReminder, reminderData, updateReminder, deleteReminder, remindersList}