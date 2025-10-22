const Booking = require("../models/Booking");
const WaitingList = require("../models/WaitingList");
const emailService = require("../services/emailService");
const axios = require("axios");
const Razorpay = require("razorpay");
const {
  createCalendarEvent,
  cancelCalendarEvent,
} = require("../services/googleCalenderService");

const razorpayId = process.env.RAZORPAY_ID;
const razorpaySecret = process.env.RAZORPAY_SECRET;

exports.searchBooking = async (req, res) => {
  try {
    const { phone, email } = req.body;
    //considering the booking which are about to come , ignoring the ones of the past so to maintain history
    const existingBooking = await Booking.findOne({
      phone,
      email: new RegExp(email, "i"),
      date: { $gte: new Date() },
    });

    if (existingBooking) {
      return res
        .status(200)
        .json({ message: "Booking found", booking: existingBooking });
    } else {
      return res
        .status(201)
        .json({ message: "No booking with this phone and email", booking: [] });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create booking method without payment integration

exports.createBookingOld = async (req, res) => {
  try {
    const { date, time, address, chamber, referredBy, name, email, phone } =
      req.body;

    // Cancel booking with same name and email

    const existingBooing = await Booking.findOne({
      phone,
      email: new RegExp(email, "i"),
      date: { $gte: new Date() },
    });

    if (existingBooing) {
      const mockReq = {
        params: { id: existingBooing._id },
        body: { email: existingBooing.email },
      };
      const mockRes = {
        json: (obj) => console.log(obj),
        status: (code) => ({ json: (obj) => console.log(code, obj) }),
      };
      await this.cancelBooking(mockReq, mockRes);
    }

    //  Check if the slot is already booked
    const existingBooking = await Booking.findOne({
      date: new Date(date),
      time,
      chamber,
    });

    if (existingBooking) {
      //  WAIT-LIST branch (NO Google Calendar)
      const count = await WaitingList.countDocuments({
        date: new Date(date),
        time,
        chamber,
      });
      const newWL = new WaitingList({
        date: new Date(date),
        time,
        address,
        chamber,
        referredBy,
        name,
        email,
        phone,
        position: count + 1,
      });
      await newWL.save();
      existingBooking.waitingList.push(newWL._id);
      await existingBooking.save();
      await emailService.sendWaitingListEmail(newWL);
      return res
        .status(201)
        .json({ message: "Added to waiting list", position: newWL.position });
    }
    //add to google calender
    const calenderId = await createCalendarEvent({
      date,
      time,
      chamber,
      name,
      email,
      phone,
      referredBy,
    });

    const newBooking = new Booking({
      date: new Date(date),
      time,
      address,
      chamber,
      referredBy,
      name,
      email,
      phone,
      status: "confirmed",
      waitingList: [],
      calenderId,
    });

    await newBooking.save();
    await emailService.sendBookingConfirmationEmail(newBooking);

    res.status(201).json({ message: "Booking confirmed", booking: newBooking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//new create booking endpoint with Razorpay integration

exports.createBooking = async (req, res) => {
  try {
    const { date, time, address, chamber, referredBy, name, email, phone } =
      req.body;

    const existingBooing = await Booking.findOne({
      phone: new RegExp(name, "i"),
      email: new RegExp(email, "i"),
      date: { $gte: new Date() },
    });

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: process.env.AMOUNT * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    if (existingBooing) {
      const mockReq = {
        params: { id: existingBooing._id },
        body: { email: existingBooing.email },
      };
      const mockRes = {
        json: (obj) => console.log(obj),
        status: (code) => ({ json: (obj) => console.log(code, obj) }),
      };
      await this.cancelBooking(mockReq, mockRes);
    }

    // Check if slot already booked
    const existingBooking = await Booking.findOne({
      date: new Date(date),
      time,
      chamber,
    });

    if (existingBooking) {
      // Waiting list logic
      const count = await WaitingList.countDocuments({
        date: new Date(date),
        time,
        chamber,
      });
      const newWL = new WaitingList({
        date: new Date(date),
        time,
        address,
        chamber,
        referredBy,
        name,
        email,
        phone,
        position: count + 1,
        status: "pending", // waiting for payment
        paymentStatus: "Pending",
        razorpayOrderId: order.id,
      });
      await newWL.save();
      existingBooking.waitingList.push(newWL._id);
      await existingBooking.save();
      // emailService.sendWaitingListEmail(newWL);
      return res.status(201).json({
        message: "Added to waiting list",
        position: newWL.position,
        orderId: order.id,
        bookingId: newWL._id,
      });
    }

    /** 🔹 Step 2: Save booking with Pending Status */
    const newBooking = new Booking({
      date: new Date(date),
      time,
      address,
      chamber,
      referredBy,
      name,
      email,
      phone,
      status: "pending", // waiting for payment
      paymentStatus: "Pending",
      razorpayOrderId: order.id,
    });

    await newBooking.save();

    res.status(201).json({
      message: "Booking initiated, waiting for payment",
      orderId: order.id,
      bookingId: newBooking._id,
      position: 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelBookingOld = async (req, res) => {
  try {
    const targetId = req.params.id;
    const { email } = req.body;

    // 0.  Email is mandatory
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    /* -------------------------------------------------
       1.  CASE 1 – cancelling a waiting-list entry
    ------------------------------------------------- */
    const wlEntry = await WaitingList.findById(targetId);
    if (wlEntry) {
      if (wlEntry.email !== email) {
        return res.status(403).json({ message: "Email does not match" });
      }

      // remove the waiting-list row
      await WaitingList.findByIdAndDelete(targetId);

      // shift remaining positions down by 1
      await WaitingList.updateMany(
        {
          date: wlEntry.date,
          chamber: wlEntry.chamber,
          time: wlEntry.time,
          position: { $gt: wlEntry.position },
        },
        { $inc: { position: -1 } }
      );

      // also pull the id from every Booking.waitingList array
      await Booking.updateMany(
        { waitingList: targetId },
        { $pull: { waitingList: targetId } }
      );
      await emailService.sendCancellationEmail(wlEntry);
      return res.json({
        message: "Waiting-list entry removed and positions shifted",
      });
    }

    /* -------------------------------------------------
       2.  CASE 2 – cancelling a confirmed booking
    ------------------------------------------------- */
    const oldBooking = await Booking.findById(targetId).populate("waitingList");
    if (!oldBooking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (oldBooking.email !== email) {
      return res.status(403).json({ message: "Email does not match" });
    }

    if (oldBooking.waitingList.length > 0) {
      const nextWL = oldBooking.waitingList.shift(); // full document
      await WaitingList.findByIdAndDelete(nextWL._id);
      const newBooking = new Booking({
        _id: nextWL._id, // reuse the same ID
        date: oldBooking.date,
        time: oldBooking.time,
        address: oldBooking.address,
        chamber: oldBooking.chamber,
        referredBy: nextWL.referredBy,
        name: nextWL.name,
        email: nextWL.email,
        phone: nextWL.phone,
        status: "confirmed",
        waitingList: oldBooking.waitingList,
      });

      //cancel from the google calender
      if (oldBooking.calenderId)
        await cancelCalendarEvent(oldBooking.calenderId);
      //make new event in google calender
      const calenderId = await createCalendarEvent({
        date: oldBooking.date.toLocaleDateString("sv-SE"),
        time: oldBooking.time,
        chamber: oldBooking.chamber,
        name: nextWL.name,
        email: nextWL.email,
        phone: nextWL.phone,
        referredBy: nextWL.referredBy,
      });
      newBooking.calenderId = calenderId;
      await newBooking.save();

      // renumber remaining waiting-list positions
      await WaitingList.updateMany(
        { _id: { $in: newBooking.waitingList } },
        { $inc: { position: -1 } }
      );

      await emailService.sendBookingConfirmationEmail(newBooking);
      await emailService.sendCancellationEmail(oldBooking);
      await Booking.findByIdAndDelete(req.params.id);

      return res.json({
        message: "Booking cancelled; next promoted, waiting list preserved",
      });
    }

    // no one in queue – simply delete and cancel from google calender
    if (oldBooking.calenderId) {
      await cancelCalendarEvent(oldBooking.calenderId);
    }

    await emailService.sendCancellationEmail(oldBooking);
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: "Booking cancelled; slot now empty" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelBookingFromEmail = async (req, res) => {
  const { token, email } = req.query;
  const booking = await Booking.findById(req.params.id);

  if (!booking || booking.cancelToken !== token) {
    return res.status(403).send(htmlPage('Invalid or expired link', false));
  }

  // -------------------- STEP 1 : show confirm page --------------------
  if (req.method === 'GET') {
    const details = {
      name: booking.name,
      chamber: booking.chamber,
      date: booking.date.toLocaleDateString('en-GB'),
      time: booking.time,
      id: booking._id,
    };
    return res.send(confirmPage(details, token, email));
  }

  // -------------------- STEP 2 : user pressed confirm --------------------
  if (req.method === 'POST') {
    const internalReq = {
      params: { id: booking._id.toString() },
      body: { email },
    };
    const internalRes = {
      json: (obj) => res.send(htmlPage(obj.message || 'Cancelled', true)),
      status: (code) => ({
        json: (obj) => res.status(code).send(htmlPage(obj.message || 'Error', false)),
      }),
    };
    await this.cancelBooking(internalReq, internalRes);
  }
};

/* --------------------  PAGES  -------------------- */
function confirmPage(d, token, email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Confirm Cancellation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f5f7fa;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    .card{background:#fff;padding:40px 50px;border-radius:8px;box-shadow:0 8px 25px rgba(0,0,0,.1);max-width:600px;text-align:center}
    h2{color:#e74c3c;margin-top:0}
    .details{background:#f8f9fa;padding:15px;border-radius:5px;margin:20px 0;text-align:left}
    .btn{display:inline-block;background:#e74c3c;color:#fff;padding:12px 24px;border:none;border-radius:4px;font-size:16px;cursor:pointer;font-weight:bold;text-decoration:none}
    .btn:hover{background:#c0392b}
  </style>
</head>
<body>
  <div class="card">
    <h2>Confirm Cancellation</h2>
    <div class="details">
      <p><strong>Patient:</strong> ${d.name}</p>
      <p><strong>Location:</strong> ${d.chamber}</p>
      <p><strong>Date:</strong> ${d.date}</p>
      <p><strong>Time:</strong> ${d.time}</p>
      <p><strong>Booking ID:</strong> ${d.id}</p>
    </div>
    <p>Are you sure you want to cancel this appointment?</p>
    <form method="POST"
      action="/api/bookings/${d.id}/cancel/email?token=${token}&email=${email}">
  <button type="submit" class="btn">Confirm Cancellation</button>
</form>
  </div>
</body>
</html>`;
}

function htmlPage(msg, success) {
  const color = success ? '#2ecc71' : '#e74c3c';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${success ? 'Cancelled' : 'Error'}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f5f7fa;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    .card{background:#fff;padding:40px 50px;border-radius:8px;box-shadow:0 8px 25px rgba(0,0,0,.1);text-align:center;max-width:420px}
    h2{color:${color};margin-top:0}
    p{font-size:16px;color:#555;margin:12px 0 24px}
    .btn{display:inline-block;background:${color};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600}
    .btn:hover{background:${success ? '#27ae60' : '#c0392b'}}
  </style>
</head>
<body>
  <div class="card">
    <h2>${success ? '✅ Cancelled' : '❌ Oops!'}</h2>
    <p>${msg}</p>
    <a href="https://www.32maxillofacial.com/home" class="btn">Back to site</a>
  </div>
</body>
</html>`;
}

exports.cancelBooking = async (req, res) => {
  try {
    const targetId = req.params.id;
    const { email } = req.body;

    // 0.  Email is mandatory
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Helper function to process refund
    const processRefund = async (paymentId, bookingData) => {
      if (process.env.ALLOW_REFUND !== "true") {
    console.log(
      `Refund skipped for ${bookingData._id || bookingData.id} because ALLOW_REFUND=false`
    );
    return null;
    }
      if (!paymentId) return null;

      try {
        console.log(`Processing refund for payment ID: ${paymentId}`);

        const refundResponse = await axios.post(
          `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
          {
            amount: parseInt(process.env.AMOUNT) * 100, // Convert to paise
            speed: "normal",
            notes: {
              reason: "User requested booking cancellation",
              bookingId: bookingData._id.toString(),
              userEmail: bookingData.email,
            },
          },
          {
            auth: {
              username: razorpayId,
              password: razorpaySecret,
            },
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        console.log(
          `Refund successful for payment ${paymentId}:`,
          refundResponse.data
        );
        return refundResponse.data;
      } catch (refundError) {
        console.error(`Failed to refund payment ${paymentId}:`, {
          message: refundError.message,
          response: refundError.response?.data,
          status: refundError.response?.status,
        });
        throw refundError;
      }
    };

    /* -------------------------------------------------
       1.  CASE 1 – cancelling a waiting-list entry
    ------------------------------------------------- */
    const wlEntry = await WaitingList.findById(targetId);
    if (wlEntry) {
      if (wlEntry.email !== email) {
        return res.status(403).json({ message: "Email does not match" });
      }

      // Process refund if payment was made
      let refundData = null;
      if (wlEntry.paymentId && wlEntry.paymentStatus === "Success") {
        try {
          refundData = await processRefund(wlEntry.paymentId, wlEntry);

          // Update payment status before deletion
          await WaitingList.findByIdAndUpdate(targetId, {
            paymentStatus: "Refunded",
            refundId: refundData.id,
            refundedAt: new Date(),
          });
        } catch (refundError) {
          // Mark refund as failed but continue with cancellation
          await WaitingList.findByIdAndUpdate(targetId, {
            paymentStatus: "Refund Failed",
            refundError: refundError.response?.data || refundError.message,
          });

          console.log("Continuing with cancellation despite refund failure");
        }
      }

      // remove the waiting-list row
      await WaitingList.findByIdAndDelete(targetId);

      // shift remaining positions down by 1
      await WaitingList.updateMany(
        {
          date: wlEntry.date,
          chamber: wlEntry.chamber,
          time: wlEntry.time,
          position: { $gt: wlEntry.position },
        },
        { $inc: { position: -1 } }
      );

      // also pull the id from every Booking.waitingList array
      await Booking.updateMany(
        { waitingList: targetId },
        { $pull: { waitingList: targetId } }
      );

      await emailService.sendCancellationEmail(wlEntry);

      const response = {
        message: "Waiting-list entry removed and positions shifted",
      };

      if (refundData) {
        response.refund = {
          status: "processed",
          refundId: refundData.id,
          amount: refundData.amount / 100, // Convert back to currency units
        };
      }

      return res.json(response);
    }

    /* -------------------------------------------------
       2.  CASE 2 – cancelling a confirmed booking
    ------------------------------------------------- */
    const oldBooking = await Booking.findById(targetId).populate("waitingList");
    if (!oldBooking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (oldBooking.email !== email) {
      return res.status(403).json({ message: "Email does not match" });
    }

    // Process refund for the cancelled booking if payment was made
    let bookingRefundData = null;
    if (oldBooking.paymentId && oldBooking.paymentStatus === "Success") {
      try {
        bookingRefundData = await processRefund(
          oldBooking.paymentId,
          oldBooking
        );

        // Update booking with refund info before deletion
        await Booking.findByIdAndUpdate(targetId, {
          paymentStatus: "Refunded",
          refundId: bookingRefundData.id,
          refundedAt: new Date(),
        });
      } catch (refundError) {
        // Mark refund as failed but continue with cancellation
        await Booking.findByIdAndUpdate(targetId, {
          paymentStatus: "Refund Failed",
          refundError: refundError.response?.data || refundError.message,
        });

        console.log(
          "Continuing with booking cancellation despite refund failure"
        );
      }
    }

    if (oldBooking.waitingList.length > 0) {
      const nextWL = oldBooking.waitingList.shift(); // full document
      await WaitingList.findByIdAndDelete(nextWL._id);

      const newBooking = new Booking({
        _id: nextWL._id, // reuse the same ID
        date: oldBooking.date,
        time: oldBooking.time,
        address: oldBooking.address,
        chamber: oldBooking.chamber,
        referredBy: nextWL.referredBy,
        name: nextWL.name,
        email: nextWL.email,
        phone: nextWL.phone,
        status: "confirmed",
        waitingList: oldBooking.waitingList,
        // Inherit payment details from waiting list entry if applicable
        paymentId: nextWL.paymentId,
        paymentStatus: nextWL.paymentStatus,
      });

      //cancel from the google calender
      if (oldBooking.calenderId)
        await cancelCalendarEvent(oldBooking.calenderId);

      //make new event in google calender
      const calenderId = await createCalendarEvent({
        date: oldBooking.date.toLocaleDateString("sv-SE"),
        time: oldBooking.time,
        chamber: oldBooking.chamber,
        name: nextWL.name,
        email: nextWL.email,
        phone: nextWL.phone,
        referredBy: nextWL.referredBy,
      });

      newBooking.calenderId = calenderId;
      await newBooking.save();

      // renumber remaining waiting-list positions
      await WaitingList.updateMany(
        { _id: { $in: newBooking.waitingList } },
        { $inc: { position: -1 } }
      );

      await emailService.sendBookingConfirmationEmail(newBooking);
      await emailService.sendCancellationEmail(oldBooking);
      await Booking.findByIdAndDelete(req.params.id);

      const response = {
        message: "Booking cancelled; next promoted, waiting list preserved",
        promotedUser: {
          name: nextWL.name,
          email: nextWL.email,
        },
      };

      if (bookingRefundData) {
        response.refund = {
          status: "processed",
          refundId: bookingRefundData.id,
          amount: bookingRefundData.amount / 100,
        };
      }

      return res.json(response);
    }

    // no one in queue – simply delete and cancel from google calender
    if (oldBooking.calenderId) {
      await cancelCalendarEvent(oldBooking.calenderId);
    }

    await emailService.sendCancellationEmail(oldBooking);
    await Booking.findByIdAndDelete(req.params.id);

    const response = {
      message: "Booking cancelled; slot now empty",
    };

    if (bookingRefundData) {
      response.refund = {
        status: "processed",
        refundId: bookingRefundData.id,
        amount: bookingRefundData.amount / 100,
      };
    }

    res.json(response);
  } catch (err) {
    console.error("Error in cancelBooking:", err);
    res.status(500).json({ error: err.message });
  }
};

//endpoint to remove booking from DB when razorpay modal is closed from users end

exports.cancelOnClose = async (req, res) => {
  try {
    const { id } = req.body;

    let booking = await Booking.findByIdAndDelete(id);
    if (booking) {
      return res.status(200).json({ message: "Booking removed from DB" });
    }

    let wlEntry = await WaitingList.findByIdAndDelete(id);
    if (wlEntry) {
      await Booking.updateMany(
        { waitingList: id },
        { $pull: { waitingList: id } }
      );
      return res
        .status(200)
        .json({ message: "Waiting list entry removed from DB" });
    }
    return res.status(404).json({ message: "Entry not found" });
  } catch (err) {
    console.error("CancelOnClose Error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
