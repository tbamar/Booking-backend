require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors    = require('cors');
const bookingRoutes = require('./routes/bookingRoutes');
const waitingListRoutes = require('./routes/waitingListRoutes');
const paymentRoutes = require ('./routes/paymentRoutes')

const cron = require('../src/jobs/reminderCron'); 
const refundCron = require ("../src/jobs/refundWaitlisted");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "*", // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false // Must be false if origin is "*"
}));

// Handle preflight requests explicitly
app.options('*', cors());

app.use(express.json());

async function connectionDB(){
 await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));
}

connectionDB();

app.use('/api/bookings', bookingRoutes);
app.use('/api/waitinglist', waitingListRoutes);
app.use('/api/payment',paymentRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
