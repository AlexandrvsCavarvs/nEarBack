const { z } = require('zod');

const sendFriendRequestSchema = z.object({
  friend_id: z.string().uuid(),
});

const respondFriendRequestSchema = z.object({
  status: z.enum(['accepted', 'blocked']),
});

module.exports = { sendFriendRequestSchema, respondFriendRequestSchema };