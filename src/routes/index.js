const express = require('express');

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const roomRoutes = require('./roomRoutes');
const trackRoutes = require('./trackRoutes');
const friendRoutes = require('./friendRoutes');
const messageRoutes = require('./messageRoutes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/rooms', roomRoutes);
router.use('/tracks', trackRoutes);
router.use('/friends', friendRoutes);
router.use('/messages', messageRoutes);

module.exports = router;