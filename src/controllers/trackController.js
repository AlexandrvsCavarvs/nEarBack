const { asyncHandler } = require('../utils/asyncHandler');
const trackService = require('../services/trackService');
const {
  searchTracksSchema,
  likeTrackSchema,
  clickTrackSchema,
} = require('../validators/trackValidators');

const search = asyncHandler(async (req, res) => {
  const { q } = searchTracksSchema.parse(req.query);
  const results = await trackService.searchTracks(q);
  res.json(results);
});

const recordListen = asyncHandler(async (req, res) => {
  const { track_id } = req.body;
  if (!track_id) {
    return res.status(400).json({ error: 'invalid_payload', message: 'track_id requis.' });
  }
  const entry = await trackService.recordListen(req.userId, track_id);
  res.status(201).json(entry);
});

const like = asyncHandler(async (req, res) => {
  const { track_id, owner_user_id } = likeTrackSchema.parse(req.body);
  const result = await trackService.likeTrack(req.userId, owner_user_id, track_id);
  res.status(201).json(result);
});

const unlike = asyncHandler(async (req, res) => {
  const { track_id, owner_user_id } = likeTrackSchema.parse(req.body);
  const result = await trackService.unlikeTrack(req.userId, owner_user_id, track_id);
  res.json(result);
});

const click = asyncHandler(async (req, res) => {
  const { to_user_id, track_id } = clickTrackSchema.parse(req.body);
  const result = await trackService.recordClick(req.userId, to_user_id, track_id);
  res.status(201).json(result);
});

module.exports = { search, recordListen, like, unlike, click };