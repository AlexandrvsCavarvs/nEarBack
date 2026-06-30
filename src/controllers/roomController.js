const { asyncHandler } = require('../utils/asyncHandler');
const roomService = require('../services/roomService');
const {
  createRoomSchema,
  addToQueueSchema,
  inviteToRoomSchema,
} = require('../validators/roomValidators');

const create = asyncHandler(async (req, res) => {
  const payload = createRoomSchema.parse(req.body);
  const room = await roomService.createRoom(req.userId, payload);
  res.status(201).json(room);
});

const listPublic = asyncHandler(async (req, res) => {
  const rooms = await roomService.listPublicRooms();
  res.json(rooms);
});

const getDetail = asyncHandler(async (req, res) => {
  const room = await roomService.getRoomDetail(req.params.roomId);
  res.json(room);
});

const join = asyncHandler(async (req, res) => {
  const result = await roomService.joinRoom(req.params.roomId, req.userId);
  res.json(result);
});

const leave = asyncHandler(async (req, res) => {
  const result = await roomService.leaveRoom(req.params.roomId, req.userId);
  res.json(result);
});

const addToQueue = asyncHandler(async (req, res) => {
  const { track_id } = addToQueueSchema.parse(req.body);
  const item = await roomService.addTrackToQueue(req.params.roomId, req.userId, track_id);
  res.status(201).json(item);
});

const advance = asyncHandler(async (req, res) => {
  const result = await roomService.advanceQueue(req.params.roomId);
  res.json(result);
});

const invite = asyncHandler(async (req, res) => {
  const { user_id } = inviteToRoomSchema.parse(req.body);
  const result = await roomService.inviteUserToRoom(req.params.roomId, user_id);
  res.json(result);
});

const close = asyncHandler(async (req, res) => {
  const result = await roomService.closeRoom(req.params.roomId, req.userId);
  res.json(result);
});

module.exports = {
  create,
  listPublic,
  getDetail,
  join,
  leave,
  addToQueue,
  advance,
  invite,
  close,
};