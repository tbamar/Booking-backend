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
      name:booking.name,
      chamber: booking.chamber,
      date: booking.date.toLocaleDateString('sv-SE'), 
      time:booking.time,
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
      name:booking.name,
      location: booking.chamber,
      date: booking.date.toLocaleDateString('sv-SE'),
      time : booking.time 
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
      name:waitingListEntry.name,
      location: waitingListEntry.chamber,
      date: waitingListEntry.date.toLocaleDateString('sv-SE'),
      position: waitingListEntry.position,
      id: waitingListEntry._id,
      time :waitingListEntry.time
    })
  };
  await transporter.sendMail(mailOptions);
};

exports.sendReminder = async (booking) => {
  const cancelUrl = `http://localhost:8000/api/bookings/${booking._id}/cancel/email?token=${booking.cancelToken}&email=${encodeURIComponent(booking.email)}`;

  const mailOptions = {
    from: EMAIL_USER,
    to: booking.email,
    subject: 'Appointment Reminder',
    html: renderTemplate('reminderMail', {
      name:booking.name,
      chamber: booking.chamber,
      date: booking.date.toLocaleDateString('sv-SE'),
      time: booking.time,
      cancelLink:cancelUrl
    })
  };

  await transporter.sendMail(mailOptions);
};