const express = require('express');
const waitingListController = require('../controllers/waitingListController');

const router = express.Router();

router.get('/', waitingListController.getWaitingList);
router.post('/count', waitingListController.countBySlot);

module.exports = router;