const express = require('express');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

router.post('/', bookingController.createBooking);
router.post('/old',bookingController.createBookingOld);
router.post('/cancelOnClose', bookingController.cancelOnClose);
router.post('/search',bookingController.searchBooking);
router.delete('/:id/cancel', bookingController.cancelBooking);
router.get('/:id/cancel/email', bookingController.cancelBookingFromEmail);

module.exports = router;