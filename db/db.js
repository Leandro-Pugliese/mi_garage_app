const mongoose = require("mongoose")
require("dotenv").config()

// Mongo atlas.
const url = process.env.MONGO
// Mongo localHost.
const mongoLocal = "mongodb://127.0.0.1:27017/mi_garage"

const db = () => {
    try {
        //mongoose.connect(url);
        mongoose.connect(mongoLocal);
        console.log("Database conected");
    } catch (err) {
        console.log(err.message);
    }
}

module.exports = { db }