const { z } = require('zod');

const searchTracksSchema = z.object({
  q: z.string().min(1).max(100),
});

const likeTrackSchema = z.object({
  track_id: z.string().uuid(),
  owner_user_id: z.string().uuid(),
});

const clickTrackSchema = z.object({
  to_user_id: z.string().uuid(),
  track_id: z.string().uuid(),
});

module.exports = { searchTracksSchema, likeTrackSchema, clickTrackSchema };