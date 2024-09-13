const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { db } = require("./db/db");
const Router = require('./routes/routes');
const schedule = require('node-schedule');
const {checkKm, checkActivity, checkPremium} = require("./cron_jobs/cron_job");

const app = express();
app.use(express.json());
app.use(cors());
db();
app.use(Router);

//Cron-job para ejecutarse los miercoles y domingos a las 22hs.
schedule.scheduleJob({ hour: 22, minute: 0, dayOfWeek: [0, 3] }, () => {
    console.log('Ejecutando tarea del miercoles y domingos a las 22:00hs');
    checkKm();
});
//Cron-job para ejecutarse todos los días a la medianoche.
schedule.scheduleJob({ hour: 0, minute: 0, dayOfWeek: [0, 1, 2, 3, 4, 5, 6] }, () => {
    console.log('Ejecutando tarea todos los dias a la medianoche');
    checkPremium();
});
//Cron-job para ejecutarse todos los días a las 6am.
schedule.scheduleJob({ hour: 6, minute: 0, dayOfWeek: [0, 1, 2, 3, 4, 5, 6] }, () => {
    console.log('Ejecutando tarea todos los dias a las 6am');
    checkActivity();
});

app.listen(process.env.PORT, () => console.log(`Server running at port: ${process.env.PORT}`));