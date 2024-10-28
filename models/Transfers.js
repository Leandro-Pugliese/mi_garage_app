const mongoose = require("mongoose");

const transfersSchema = new mongoose.Schema({
    uniqueCode: {
        type: String,
        required: true,
        unique: true
    },
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
    },
    status: {
        type: String,
        require: true
    }
}, {versionKey: false});

const Transfer = mongoose.model("Transfer", transfersSchema);

module.exports = Transfer;