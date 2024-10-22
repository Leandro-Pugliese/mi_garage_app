const mongoose = require("mongoose");

const paymentsSchema = new mongoose.Schema({
    user: {
        type: String,
        required: true
    },
    paymentId: {
        type: String,
        required: true
    },
    paymentType: {
        type: String,
        required: true
    },
    paymentDate: {
        type: Date,
        required: true
    },
    paymentSource: {
        type: String,
        required: true
    },
    paymentAmount: {
        type: Number,
        required: true
    }
}, {versionKey: false});

const Payment = mongoose.model("Payment", paymentsSchema);

module.exports = Payment;