const Booking = require("../models/Booking");
const WaitingList = require("../models/WaitingList");
const emailService = require("../services/emailService");

exports.createBooking = async (req, res) => {
  try {
    const { date, fromTime, toTime, name, location, email } = req.body;
    const existingBooking = await Booking.findOne({
      date,
      fromTime,
      toTime,
      location,
    });
    if (existingBooking) {
      const newWaitingListEntry = new WaitingList({
        date,
        fromTime,
        toTime,
        name,
        location,
        email,
        position: existingBooking.waitingList.length + 1,
      });
      existingBooking.waitingList.push(newWaitingListEntry);
      await existingBooking.save();
      await newWaitingListEntry.save();
      emailService.sendWaitingListEmail(newWaitingListEntry);
      return res
        .status(201)
        .json({
          message: "Added to waiting list",
          position: newWaitingListEntry.position,
        });
    }
    const newBooking = new Booking({
      date,
      fromTime,
      toTime,
      name,
      location,
      email,
    });
    await newBooking.save();
    emailService.sendBookingConfirmationEmail(newBooking);
    res.status(201).json({ message: "Booking created", booking: newBooking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const oldBooking = await Booking.findById(req.params.id).populate(
      "waitingList"
    );
    if (!oldBooking)
      return res.status(404).json({ message: "Booking not found" });

    if (oldBooking.waitingList.length > 0) {
      
      const nextWL = oldBooking.waitingList.shift(); 

      const newBooking = new Booking({
        date: oldBooking.date,
        fromTime: oldBooking.fromTime,
        toTime: oldBooking.toTime,
        location: oldBooking.location,
        name: nextWL.name,
        email: nextWL.email,
        status: "confirmed",
        waitingList: oldBooking.waitingList, 
      });

      await newBooking.save();  

      //deleting the 1st waitlist and shifiting the other in the left by 1 position
      await WaitingList.findByIdAndDelete(nextWL._id);
      await WaitingList.updateMany(
        { _id: { $in: newBooking.waitingList } },
        { $inc: { position: -1 } }
      );

      emailService.sendBookingConfirmationEmail(newBooking);
      emailService.sendCancellationEmail(oldBooking);

      //deleteing the confirmed booking from DB
      await Booking.findByIdAndDelete(req.params.id);

      return res.json({
        message: "Booking cancelled; next promoted, waiting list preserved",
      });
    }

    emailService.sendCancellationEmail(oldBooking);
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: "Booking cancelled; slot now empty" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
