const express = require('express');
const friendController = require('../controllers/friendController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', friendController.list);
router.get('/pending', friendController.pending);
router.post('/request', friendController.sendRequest);
router.patch('/:friendshipId', friendController.respond);
router.delete('/:friendshipId', friendController.remove);

module.exports = router;