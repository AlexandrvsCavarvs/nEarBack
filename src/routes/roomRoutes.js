const express = require('express');
const roomController = require('../controllers/roomController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

router.post('/', roomController.create);
router.get('/', roomController.listPublic);
router.get('/:roomId', roomController.getDetail);
router.post('/:roomId/join', roomController.join);
router.post('/:roomId/leave', roomController.leave);
router.post('/:roomId/queue', roomController.addToQueue);
router.post('/:roomId/advance', roomController.advance);
router.post('/:roomId/invite', roomController.invite);
router.post('/:roomId/close', roomController.close);

module.exports = router;