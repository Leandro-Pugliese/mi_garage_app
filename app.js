const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { db } = require("./db/db");
const Router = require('./routes/routes');
const {cronJob, cronJob1, cronJob2} = require("./cron_jobs/cron_job");

const app = express();
app.use(express.json());
app.use(cors());
db();
app.use(Router);
//Crono Jobs
cronJob();
cronJob1();
cronJob2();

app.listen(process.env.PORT, () => console.log(`Server running at port: ${process.env.PORT}`));