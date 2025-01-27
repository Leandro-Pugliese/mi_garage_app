const mongoose = require("mongoose")
require("dotenv").config()

const db = () => {
    try {
        //mongoose.connect(url);
        mongoose.connect(process.env.MONGO);
        console.log("Database conected");
    } catch (err) {
        console.log(err.message);
    }
}

module.exports = { db }