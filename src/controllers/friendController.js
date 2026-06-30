const { asyncHandler } = require('../utils/asyncHandler');
const friendService = require('../services/friendService');
const {
  sendFriendRequestSchema,
  respondFriendRequestSchema,
} = require('../validators/friendValidators');

const list = asyncHandler(async (req, res) => {
  const friends = await friendService.listFriends(req.userId);
  res.json(friends);
});

const pending = asyncHandler(async (req, res) => {
  const requests = await friendService.listPendingRequests(req.userId);
  res.json(requests);
});

const sendRequest = asyncHandler(async (req, res) => {
  const { friend_id } = sendFriendRequestSchema.parse(req.body);
  const request = await friendService.sendFriendRequest(req.userId, friend_id);
  res.status(201).json(request);
});

const respond = asyncHandler(async (req, res) => {
  const { status } = respondFriendRequestSchema.parse(req.body);
  const result = await friendService.respondToRequest(req.params.friendshipId, req.userId, status);
  res.json(result);
});

const remove = asyncHandler(async (req, res) => {
  const result = await friendService.removeFriend(req.params.friendshipId, req.userId);
  res.json(result);
});

module.exports = { list, pending, sendRequest, respond, remove };