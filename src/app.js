require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bookingRoutes = require('./routes/bookingRoutes');
const waitingListRoutes = require('./routes/waitingListRoutes');
const config = require('../config/db.js');
const emailConfig = require('../config/emailConfig.js');

const app = express();
const PORT = process.env.PORT || 3000;
console.log(process.env.MONGO_URI);
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.use('/api/bookings', bookingRoutes);
app.use('/api/waitinglist', waitingListRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));