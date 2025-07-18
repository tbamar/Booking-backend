require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors    = require('cors');
const bookingRoutes = require('./routes/bookingRoutes');
const waitingListRoutes = require('./routes/waitingListRoutes');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.use('/api/bookings', bookingRoutes);
app.use('/api/waitinglist', waitingListRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));