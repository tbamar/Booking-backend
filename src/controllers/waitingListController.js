const WaitingList = require('../models/WaitingList');
const BookingList = require('../models/Booking')

exports.getWaitingList = async (req, res) => {
  try {
    const waitingList = await WaitingList.find();
    res.status(200).json(waitingList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.countBySlot = async (req, res) => {
  try {
    const { date, chamber, time } = req.body;

    if (!date || !chamber || !time) {
      return res.status(400).json({ error: 'date, chamber and time are required' });
    }
    let count = await WaitingList.countDocuments({
      date: new Date(date),
      chamber,
      time
    });

    count+= await BookingList.countDocuments({
      date: new Date(date),
      chamber,
      time
    });

    res.json({count});

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};