const mongoose = require('mongoose');

const waitingListSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  fromTime: { type: String, required: true },
  toTime: { type: String, required: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  email: { type: String, required: true },
  position: { type: Number, required: true }
});

module.exports = mongoose.model('WaitingList', waitingListSchema);