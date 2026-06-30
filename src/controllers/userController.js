const { asyncHandler } = require('../utils/asyncHandler');
const userService = require('../services/userService');
const { updateProfileSchema, searchUsersSchema } = require('../validators/userValidators');

const getMe = asyncHandler(async (req, res) => {
  const profile = await userService.getUserProfile(req.userId);
  res.json(profile);
});

const getUserById = asyncHandler(async (req, res) => {
  const profile = await userService.getUserProfile(req.params.userId);
  res.json(profile);
});

const updateMe = asyncHandler(async (req, res) => {
  const updates = updateProfileSchema.parse(req.body);
  const updated = await userService.updateUserProfile(req.userId, updates);
  res.json(updated);
});

const search = asyncHandler(async (req, res) => {
  const { q } = searchUsersSchema.parse(req.query);
  const results = await userService.searchUsers(q, req.userId);
  res.json(results);
});

module.exports = { getMe, getUserById, updateMe, search };