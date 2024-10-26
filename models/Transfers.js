const mongoose = require("mongoose");

const transfersSchema = new mongoose.Schema({
    owner: {
        type: String,
        required: true
    },
    newOwner: {
        type: String,
        required: true
    },
    vehicle: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    }
}, {versionKey: false});

const Transfer = mongoose.model("Transfer", transfersSchema);

module.exports = Transfer;