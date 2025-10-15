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
    enum: ["confirmed", "cancelled", "pending"],
    default: "pending",
  },
  calenderId: { type: String },
  cancelToken: {
    type: String,
    default: () => crypto.randomBytes(16).toString("hex"),
  },
  reminderSent: { type: Boolean, default: false },
  waitingList: [{ type: mongoose.Schema.Types.ObjectId, ref: "WaitingList" }],
  razorpayOrderId:{type:String, default : null},
  paymentId:{type:String, default : null},
  paymentStatus:{type: String,
    enum: ["Pending", "Success","Refunded","N/A"],
    default: "N/A",}
});

module.exports = mongoose.model("Booking", bookingSchema);
