const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.post('/createOrder', paymentController.createOrder);
router.post('/verifyPayment', paymentController.verifyPayment);

module.exports =router;