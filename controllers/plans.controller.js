const express = require("express");
const Plans = require("../models/plans");

const plansList = async (req, res) => {
    try {
        const plans = await Plans.find();
        return res.status(200).send(plans);
    } catch (error) {
        console.log(error);
        return res.status(500).send(error.message);
    }
}

 module.exports = {plansList}