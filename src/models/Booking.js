const mongoose = require("mongoose");
const crypto = require('crypto');

const bookingSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  time: { type: String, required: true },
  address: { type: String, required: true },
  chamber: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  referredBy: { type: String },
  status: {
    type: String,
    enum: ["confirmed", "cancelled"],
    default: "confirmed",
  },
  calenderId: { type: String },
  cancelToken: {
    type: String,
    default: () => crypto.randomBytes(16).toString("hex"),
  },
  reminderSent: { type: Boolean, default: false },
  waitingList: [{ type: mongoose.Schema.Types.ObjectId, ref: "WaitingList" }],
});

module.exports = mongoose.model("Booking", bookingSchema);
