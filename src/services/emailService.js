require('dotenv').config();
const nodemailer = require('nodemailer');
const { EMAIL_USER, EMAIL_PASS } = process.env;
const { renderTemplate } = require('./email-templates/index');

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
    html: renderTemplate('bookingConfirmation', {
      chamber: booking.chamber,
      date: booking.date, 
      id: booking._id
    })
  };
  await transporter.sendMail(mailOptions);
};

exports.sendCancellationEmail = async (booking) => {
  const mailOptions = {
    from: EMAIL_USER,
    to: booking.email,
    subject: 'Booking Cancellation',
    html: renderTemplate('bookingCancellation', {
      location: booking.chamber,
      date: booking.date, 
    })
  };
  await transporter.sendMail(mailOptions);
};

exports.sendWaitingListEmail = async (waitingListEntry) => {
  const mailOptions = {
    from: EMAIL_USER,
    to: waitingListEntry.email,
    subject: 'Waiting List Confirmation',
    html: renderTemplate('waitingList', {
      location: waitingListEntry.chamber,
      date: waitingListEntry.date,
      position: waitingListEntry.position,
      id: waitingListEntry._id
    })
  };
  await transporter.sendMail(mailOptions);
};