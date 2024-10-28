const express = require("express");
const Plans = require("../models/plans");
//const {plansList} = require('../assets/planesPremium');

// const createPlans = async (req, res) => {
//     for (let i=0; i < plansList.length; i++) {
//         await Plans.create({
//             name: plansList[i].name,
//             description: plansList[i].description,
//             amount: plansList[i].amount,
//             months: plansList[i].months,
//             type: plansList[i].type
//         })
//     }
//     return res.status(201).send('Planes creados');
// }

// module.exports = {createPlans}