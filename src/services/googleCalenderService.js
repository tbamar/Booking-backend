const { google } = require('googleapis');
const { add, parseISO, format } = require('date-fns');

const CALENDAR_ID = process.env.CALENDAR_ID ;

const SCOPES = [
	'https://www.googleapis.com/auth/calendar',
	'https://www.googleapis.com/auth/calendar.events',
];

// ---------- Auth ----------
const initGoogleCalendar = async () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
  });
  return google.calendar({ version: 'v3', auth: await auth.getClient() });
};

// ---------- Create 30-min confirmed booking ----------
const createCalendarEvent = async ({
  date,
  time,
  chamber,
  name,
  email,
  phone,
  referredBy,
}) => {

  const startISO = `${date}T${time}:00`;
  const endISO   = format(add(parseISO(startISO), { minutes: 30 }), 'yyyy-MM-dd\'T\'HH:mm:ss');

  const event = {
    summary: `Appointment with ${name}`,
    description: `Patient: ${name}\nEmail: ${email}\nPhone: ${phone}\nReferred by: ${referredBy || 'N/A'}`,
    location: chamber,
    start: { dateTime: startISO, timeZone: 'Asia/Kolkata' },
    end:   { dateTime: endISO,   timeZone: 'Asia/Kolkata' },
    conferenceData: {
      createRequest: {
        requestId: Math.random().toString(36).slice(-8),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 30 }] },
  };

  const cal = await initGoogleCalendar();
  const resp = await cal.events.insert({ calendarId: CALENDAR_ID, requestBody: event });
  //console.log(resp);
  return resp.status === 200 ? `${resp.data.id}` : `Google error ${resp.status}`;
};

const cancelCalendarEvent = async (eventId) => {
    const cal = await initGoogleCalendar();
    await cal.events.delete({
      calendarId: CALENDAR_ID,
      eventId,
    });
    return 'Calendar event cancelled';
  };
  
  module.exports = { createCalendarEvent, cancelCalendarEvent };