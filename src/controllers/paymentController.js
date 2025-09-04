const Razorpay = require('razorpay');
const Payment = require("../models/Payment");
const crypto = require("crypto");
const Booking =require("../models/Booking");
const {
    createCalendarEvent,
    cancelCalendarEvent,
  } = require("../services/googleCalenderService");

const emailService = require("../services/emailService");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
});

//------- Create Razorpay Order ------//
exports.createOrder = async (req, res) => {
    try {
        // 1. Validate incoming request (highly recommended)
        const { amount, currency, receipt, notes } = req.body;

        if (!amount || !currency) {
            return res.status(400).json({ message: 'Amount and Currency are required.' });
        }

        // 2. Create the order options object on the SERVER.
        // This prevents clients from tampering with the amount or currency.
        const options = {
            amount: Number(amount) * 100, // Razorpay expects amount in paise (e.g., 100 INR = 10000 paise)
            currency: currency || "INR",
            receipt: receipt || `receipt_${Date.now()}`,
            payment_capture: 1, // Auto-capture payment. Use 0 for manual capture.
            notes: notes || {} // Optional custom notes
        };

        // 3. Create the order with the server-defined options
        const order = await razorpay.orders.create(options);

        // 4. Optionally, save the order details to your DB before sending it to the client
        // const newPaymentRecord = new Payment({
        //     orderId: order.id,
        //     amount: options.amount,
        //     currency: options.currency,
        //     receipt: options.receipt,
        //     status: 'created', // Initial status
        //     // Add other relevant fields like userId from req.user
        // });
        // await newPaymentRecord.save();

        // 5. Send the order info back to the client
        res.status(200).json({
            success: true,
            order: order,
            message: "Order created successfully"
        });

    } catch (err) {
        console.error("Razorpay Order Creation Error:", err);
        // Handle specific Razorpay errors more gracefully
        if (err.error?.reason) {
            return res.status(500).json({
                success: false,
                message: `Payment error: ${err.error.reason}`
            });
        }
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: err.message
        });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;
  
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_SECRET)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');
  
      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid signature' });
      }
  
      // Update booking
      const booking = await Booking.findByIdAndUpdate(
        bookingId,
        {
          status: 'confirmed',
          paymentStatus: 'Success',
          paymentId: razorpay_payment_id,
        },
        { new: true }
      );
  
      /** 🔹 Step 3: Now create Calendar Event */
      const dateObj = new Date(booking.date);

// Convert the Date object back to an ISO string and get the date part
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
      await booking.save();
  
      /** 🔹 Step 4: Send confirmation email */
      emailService.sendBookingConfirmationEmail(booking);
  
      res.status(200).json({ message: 'Payment verified & booking confirmed', booking });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  