const fs = require('fs');
const path = require('path');

const templates = {
  bookingConfirmation: fs.readFileSync(path.join(__dirname, 'booking-confirmation.html'), 'utf8'),
  bookingCancellation: fs.readFileSync(path.join(__dirname, 'booking-cancellation.html'), 'utf8'),
  waitingList: fs.readFileSync(path.join(__dirname, 'waiting-list.html'), 'utf8')
};

exports.renderTemplate = (templateName, data) => {
  let template = templates[templateName];
  if (!template) throw new Error(`Template ${templateName} not found`);
  
  // Replace placeholders with actual data
  for (const [key, value] of Object.entries(data)) {
    template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  return template;
};