const { asyncHandler } = require('../utils/asyncHandler');
const messageService = require('../services/messageService');

const send = asyncHandler(async (req, res) => {
  const { room_id, to_user_id, text } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'invalid_payload', message: 'text requis.' });
  }

  const message = await messageService.sendMessage(req.userId, {
    roomId: room_id,
    toUserId: to_user_id,
    text: text.trim(),
  });

  res.status(201).json(message);
});

const getRoomHistory = asyncHandler(async (req, res) => {
  const { limit, before } = req.query;
  const messages = await messageService.getRoomMessages(req.params.roomId, {
    limit: limit ? Number(limit) : undefined,
    before,
  });
  res.json(messages);
});

const getPrivateHistory = asyncHandler(async (req, res) => {
  const { limit, before } = req.query;
  const messages = await messageService.getPrivateConversation(
    req.userId,
    req.params.userId,
    { limit: limit ? Number(limit) : undefined, before }
  );
  res.json(messages);
});

const remove = asyncHandler(async (req, res) => {
  const result = await messageService.deleteMessage(req.params.messageId, req.userId);
  res.json(result);
});

module.exports = { send, getRoomHistory, getPrivateHistory, remove };