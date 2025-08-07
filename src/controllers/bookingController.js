const Booking = require("../models/Booking");
const WaitingList = require("../models/WaitingList");
const emailService = require("../services/emailService");
const { createCalendarEvent,cancelCalendarEvent } = require('../services/googleCalenderService');

/*-----------searchBooking------------*/
exports.searchBooking = async(req,res)=>{
  try{
    const{name, email} = req.body;
 //considering the booking which are about to come , ignoring the ones of the past so to maintain history
    const existingBooking = await Booking.findOne({
      name: new RegExp(name, 'i'), 
      email: new RegExp(email, 'i'),
      date: { $gte: new Date() } ,
    })
    const date = new Date();
    
      if(existingBooking){
        return res.status(200).json({message: 'Booking found', booking: existingBooking});
      }
      else{
        return res.status(201).json({message:'No booking with this name and email', booking:[]});
      }
    
  }
  catch(err){
    res.status(500).json({error:err.message});
  }
}

/* ---------- createBooking ---------- */
exports.createBooking = async (req, res) => {
  try {
    const { date, time, address, chamber, referredBy, name, email, phone } = req.body;

    /* 0.  Cancel booking with same name and email */

    const existingBooing = await Booking.findOne({
      name: new RegExp(name, 'i'), 
      email: new RegExp(email, 'i'),
      date: { $gte: new Date() } 
    })

    if (existingBooing ) {
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

    /* 1.  Check if the slot is already booked */
    const existingBooking = await Booking.findOne({
      date: new Date(date),
      time,
      chamber,
    });

    if (existingBooking) {
      /* --- WAIT-LIST branch (NO Google Calendar) --- */
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
      emailService.sendWaitingListEmail(newWL);
      return res.status(201).json({ message: 'Added to waiting list', position: newWL.position });
    }
//add to google calender
    const calenderId= await createCalendarEvent({
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
      status: 'confirmed',
      waitingList: [],
      calenderId
    });

    await newBooking.save();
    emailService.sendBookingConfirmationEmail(newBooking);

    res.status(201).json({ message: 'Booking confirmed', booking: newBooking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.cancelBooking = async (req, res) => {
  try {
    const targetId = req.params.id;
    const { email } = req.body;

    // 0.  Email is mandatory
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    /* -------------------------------------------------
       1.  CASE 1 – cancelling a waiting-list entry
    ------------------------------------------------- */
    const wlEntry = await WaitingList.findById(targetId);
    if (wlEntry) {
      if (wlEntry.email !== email) {
        return res.status(403).json({ message: 'Email does not match' });
      }

      // remove the waiting-list row
      await WaitingList.findByIdAndDelete(targetId);

      // shift remaining positions down by 1
      await WaitingList.updateMany(
        { date: wlEntry.date, chamber: wlEntry.chamber, time: wlEntry.time, position: { $gt: wlEntry.position } },
        { $inc: { position: -1 } }
      );

      // also pull the id from every Booking.waitingList array
      await Booking.updateMany(
        { waitingList: targetId },
        { $pull: { waitingList: targetId } }
      );
      emailService.sendCancellationEmail(wlEntry);
      return res.json({ message: 'Waiting-list entry removed and positions shifted' });
    }

    /* -------------------------------------------------
       2.  CASE 2 – cancelling a confirmed booking
    ------------------------------------------------- */
    const oldBooking = await Booking.findById(targetId).populate('waitingList');
    if (!oldBooking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (oldBooking.email !== email) {
      return res.status(403).json({ message: 'Email does not match' });
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
        status: 'confirmed',
        waitingList: oldBooking.waitingList,
      });
  
      //cancel from the google calender
      if(oldBooking.calenderId)
      await cancelCalendarEvent(oldBooking.calenderId);
      //make new event in google calender
      const calenderId= await createCalendarEvent({
        date:oldBooking.date.toLocaleDateString('sv-SE'),
        time:oldBooking.time,
        chamber:oldBooking.chamber,
        name:nextWL.name,
        email:nextWL.email,
        phone:nextWL.phone,
        referredBy:nextWL.referredBy,
      });
      newBooking.calenderId = calenderId;
      await newBooking.save();

      // delete promoted waiting-list row
     // await WaitingList.findByIdAndDelete(nextWL._id);

      // renumber remaining waiting-list positions
      await WaitingList.updateMany(
        { _id: { $in: newBooking.waitingList } },
        { $inc: { position: -1 } }
      );

      emailService.sendBookingConfirmationEmail(newBooking);
      emailService.sendCancellationEmail(oldBooking);
      await Booking.findByIdAndDelete(req.params.id);

      return res.json({ message: 'Booking cancelled; next promoted, waiting list preserved' });
    }

    // no one in queue – simply delete and cancel from google calender
    if (oldBooking.calenderId) {
      await cancelCalendarEvent(oldBooking.calenderId);
    }

    emailService.sendCancellationEmail(oldBooking);
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ message: 'Booking cancelled; slot now empty' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

