const WaitingList = require('../models/WaitingList');

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
    const { date, location, fromTime, toTime } = req.body;

    if (!date || !location || !fromTime || !toTime) {
      return res.status(400).json({ error: 'date, location, fromTime and toTime are required' });
    }

    const count = await WaitingList.countDocuments({
      date: new Date(date),
      location,
      fromTime,
      toTime
    });

    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};