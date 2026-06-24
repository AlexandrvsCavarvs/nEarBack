const { z } = require('zod');

const updateProfileSchema = z.object({
  username: z.string().min(3).max(100).optional(),
  avatar_url: z.string().url().optional().nullable(),
  banner_url: z.string().url().optional().nullable(),
  preferences: z.record(z.any()).optional(),
  country: z.string().uuid().optional().nullable(),
});

const searchUsersSchema = z.object({
  q: z.string().min(1).max(100),
});

module.exports = { updateProfileSchema, searchUsersSchema };