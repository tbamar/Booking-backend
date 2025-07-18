const mongoose = require('mongoose');

const waitingListSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  time: { type: String, required: true },
  address : { type: String, required: true },
  chamber : { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  referredBy:{type:String},
  position: { type: Number, required: true }
});

module.exports = mongoose.model('WaitingList', waitingListSchema);