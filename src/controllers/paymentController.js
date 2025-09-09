const Razorpay = require("razorpay");
const crypto = require("crypto");
const Booking = require("../models/Booking");

const { createCalendarEvent } = require("../services/googleCalenderService");

const emailService = require("../services/emailService");
const WaitingList = require("../models/WaitingList");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

//------- Create Razorpay Order ------//
exports.createOrder = async (req, res) => {
  try {
    const { amount, currency, receipt, notes } = req.body;

    if (!amount || !currency) {
      return res
        .status(400)
        .json({ message: "Amount and Currency are required." });
    }

    const options = {
      amount: Number(amount) * 100,
      currency: currency || "INR",
      receipt: receipt || `receipt_${Date.now()}`,
      payment_capture: 1,
      notes: notes || {},
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order: order,
      message: "Order created successfully",
    });
  } catch (err) {
    console.error("Razorpay Order Creation Error:", err);
    if (err.error?.reason) {
      return res.status(500).json({
        success: false,
        message: `Payment error: ${err.error.reason}`,
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};

//verify payment endpoint
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
      position,
    } = req.body;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      if (position == 0) await Booking.findByIdAndDelete(bookingId);
      else {
        await WaitingList.findByIdAndDelete(req.id);
        await Booking.updateMany(
          { waitingList: bookingId },
          { $pull: { waitingList: bookingId } }
        );
      }
      return res.status(400).json({ error: "Invalid signature" });
    }
    //only for waitlisted tickets
    if (position != 0) {
      const booking = await WaitingList.findByIdAndUpdate(
        bookingId,
        {
          status: "confirmed",
          paymentStatus: "Success",
          paymentId: razorpay_payment_id,
        },
        { new: true }
      );
      await booking.save();
      await emailService.sendWaitingListEmail(booking);

      res.status(200).json({
        message: "Payment verified & waitlisted booking given",
        booking,
      });
    }

    // Update booking
    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        status: "confirmed",
        paymentStatus: "Success",
        paymentId: razorpay_payment_id,
      },
      { new: true }
    );

    //creating calender event
    const dateObj = new Date(booking.date);

    const dateOnly = dateObj.toISOString().slice(0, 10);
    const calenderId = await createCalendarEvent({
      date: dateOnly,
      time: booking.time,
      chamber: booking.chamber,
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      referredBy: booking.referredBy,
    });

    booking.calenderId = calenderId;
    //saving and updating record
    await booking.save();

    //sending confirmation mail
    await emailService.sendBookingConfirmationEmail(booking);

    res
      .status(200)
      .json({ message: "Payment verified & booking confirmed", booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
