const { z } = require('zod');

const createRoomSchema = z.object({
  room_name: z.string().min(1).max(100),
  is_private: z.boolean().default(false),
});

const addToQueueSchema = z.object({
  track_id: z.string().uuid(),
});

const inviteToRoomSchema = z.object({
  user_id: z.string().uuid(),
});

module.exports = { createRoomSchema, addToQueueSchema, inviteToRoomSchema };