const express = require('express');
const userController = require('../controllers/userController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.get('/search', userController.search);
router.get('/:userId', userController.getUserById);

module.exports = router;