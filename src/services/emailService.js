require('dotenv').config();
const nodemailer = require('nodemailer');
const { EMAIL_USER, EMAIL_PASS } = process.env;

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
  },
  tls: {
      rejectUnauthorized: false,
  }
});

exports.sendBookingConfirmationEmail = async (booking) => {
  const mailOptions = {
    from: EMAIL_USER,
    to: booking.email,
    subject: 'Booking Confirmation',
    text: `Your booking for ${booking.date} at ${booking.location} is confirmed.`
  };
  await transporter.sendMail(mailOptions);
};

exports.sendCancellationEmail = async (booking) => {
  const mailOptions = {
    from: EMAIL_USER,
    to: booking.email,
    subject: 'Booking Cancellation',
    text: `Your booking for ${booking.date} at ${booking.location} has been cancelled.`
  };
  await transporter.sendMail(mailOptions);
};

exports.sendWaitingListEmail = async (waitingListEntry) => {
  const mailOptions = {
    from: EMAIL_USER,
    to: waitingListEntry.email,
    subject: 'Waiting List Confirmation',
    text: `You have been added to the waiting list for ${waitingListEntry.date} at ${waitingListEntry.location}. Your position is ${waitingListEntry.position}.`
  };
  await transporter.sendMail(mailOptions);
};