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

    } catch (error) {
        console.log(error);
        return res.status(500).send(error.message);
    }
}

const updateReminder = async (req, res) => {
    try {

    } catch (error) {
        console.log(error);
        return res.status(500).send(error.message);
    }
}

const deleteReminder = async (req, res) => {
    try {

    } catch (error) {
        console.log(error);
        return res.status(500).send(error.message);
    }
}

const remindersList = async (req, res) => {
    try {

    } catch (error) {
        console.log(error);
        return res.status(500).send(error.message);
    }
}


module.exports = {createReminder, reminderData, updateReminder, deleteReminder, remindersList}