const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  fromTime: { type: String, required: true },
  toTime: { type: String, required: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  email: { type: String, required: true },
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
  waitingList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WaitingList' }]
});

module.exports = mongoose.model('Booking', bookingSchema);