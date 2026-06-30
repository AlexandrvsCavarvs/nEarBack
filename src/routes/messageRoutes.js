const express = require('express');
const messageController = require('../controllers/messageController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

router.post('/', messageController.send);
router.get('/room/:roomId', messageController.getRoomHistory);
router.get('/private/:userId', messageController.getPrivateHistory);
router.delete('/:messageId', messageController.remove);

module.exports = router;