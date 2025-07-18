const Booking = require("../models/Booking");
const WaitingList = require("../models/WaitingList");
const emailService = require("../services/emailService");

exports.createBooking = async (req, res) => {
  try {
    const { date, time, name, address, chamber,phone, email, referredBy } = req.body;
    const existingBooking = await Booking.findOne({
      date,
      time,
      chamber
    });
    if (existingBooking) {
      const newWaitingListEntry = new WaitingList({
        date,
        time,
        name,
        email,
        chamber,
        address,
        phone,
        referredBy,
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
      time,
      name,
      chamber,
      address,
      email,
      referredBy,
      phone
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

    //code to cancel booking from the waitlisted area
    const targetId = req.params.id; 

    const wlEntry = await WaitingList.findById(targetId);
    if (wlEntry) {
      
      await WaitingList.findByIdAndDelete(targetId);

      await WaitingList.updateMany(
        { date: wlEntry.date, chamber: wlEntry.chamber, time: wlEntry.time, position: { $gt: wlEntry.position } },
        { $inc: { position: -1 } }
      );

      await Booking.updateMany(
        { waitingList: targetId },
        { $pull: { waitingList: targetId } }
      );

      return res.json({ message: 'Waiting-list entry removed and positions shifted' });
    }
    

    const oldBooking = await Booking.findById(req.params.id).populate(
      "waitingList"
    );
    if (!oldBooking)
      return res.status(404).json({ message: "Booking not found" });

    if (oldBooking.waitingList.length > 0) {
      
      const nextWL = oldBooking.waitingList.shift(); 

      const newBooking = new Booking({
        date: oldBooking.date,
        time:oldBooking.time,
        address: oldBooking.address,
        chamber:oldBooking.chamber,
        referredBy:nextWL.referredBy,
        name: nextWL.name,
        email: nextWL.email,
        phone:nextWL.phone,
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
