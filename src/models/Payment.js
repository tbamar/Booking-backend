const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        required: true,
        enum: ['usd', 'eur', 'gbp', 'inr'] // Add more currencies as needed
    },
    paymentMethodId: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    customerName: {
        type: String,
        required: true
    }, 
    bookingDate: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Payment', paymentSchema);
