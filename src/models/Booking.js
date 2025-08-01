const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  time: { type: String, required: true },
  address : { type: String, required: true },
  chamber : { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  referredBy:{type:String},
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
  calenderId: {type:String},
  waitingList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WaitingList' }]
});

module.exports = mongoose.model('Booking', bookingSchema);