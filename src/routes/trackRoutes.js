const express = require('express');
const trackController = require('../controllers/trackController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/search', trackController.search);
router.post('/listen', trackController.recordListen);
router.post('/like', trackController.like);
router.post('/unlike', trackController.unlike);
router.post('/click', trackController.click);

module.exports = router;