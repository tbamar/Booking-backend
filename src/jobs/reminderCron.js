const cron = require("node-cron");
const Booking = require("../models/Booking");
const { sendReminder } = require("../services/emailService");

cron.schedule("0 * * * *", async () => {
  const now = new Date();
  const twelveHoursLater = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  const bookings = await Booking.aggregate([
    {
      $addFields: {
        fullDateTime: {
          $dateFromString: {
            dateString: {
              $concat: [
                { $dateToString: { date: "$date", format: "%Y-%m-%d" } },
                "T",
                "$time",
                ":00Z",
              ],
            },
          },
        },
      },
    },
    {
      $match: {
        reminderSent: false,
        fullDateTime: { $gte: now, $lte: twelveHoursLater },
      },
    },
  ]);

  if (bookings.length > 0) {
    for (const b of bookings) {
      await sendReminder(b);
      await Booking.updateOne({ _id: b._id }, { $set: { reminderSent: true } });
    }
  }
});
