const { Server } = require('socket.io');
const authService = require('../services/authService');
const messageService = require('../services/messageService');
const roomService = require('../services/roomService');

/**
 * Toute la logique temps réel vit ici. Le front ne parle qu'à ce serveur
 * Socket.io (même domaine que l'API REST) -- jamais directement à Supabase.
 *
 * Évènements émis par le client :
 *   - 'room:join'        { roomId }
 *   - 'room:leave'       { roomId }
 *   - 'room:message'     { roomId, text }
 *   - 'room:queue:add'   { roomId, trackId }
 *   - 'room:queue:advance' { roomId }
 *   - 'dm:send'           { toUserId, text }
 *
 * Évènements reçus par le client :
 *   - 'room:message:new'   { id, message, created_at, sender }
 *   - 'room:queue:updated' { ...room queue snapshot }
 *   - 'room:presence'      [{ userId, username, avatarUrl }]
 *   - 'dm:new'              { id, message, created_at, sender, to_user_id }
 *   - 'error'               { message }
 */

let io;

// userId -> Set<socketId> -- permet de savoir qui est connecté globalement
// (utile pour la présence sur la carte plus tard) et de gérer le cas où
// un même utilisateur a plusieurs onglets/appareils ouverts.
const connectedSockets = new Map();

// roomId -> Map<userId, { username, avatarUrl }> -- présence par salon
const roomPresence = new Map();

function initSocketServer(httpServer, { allowedOrigins }) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    },
  });

  // ─── Authentification du socket ────────────────────────────────────────────
  // Le client doit fournir le token dans `auth: { token }` lors de la connexion
  // (voir src/services/socketClient.ts côté front).

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('unauthorized'));
    }

    const user = await authService.verifyAccessToken(token);
    if (!user) {
      return next(new Error('unauthorized'));
    }

    socket.userId = user.id;
    socket.userEmail = user.email;
    next();
  });

  io.on('connection', socket => {
    registerSocket(socket);

    socket.on('room:join', payload => handleRoomJoin(socket, payload));
    socket.on('room:leave', payload => handleRoomLeave(socket, payload));
    socket.on('room:message', payload => handleRoomMessage(socket, payload));
    socket.on('room:queue:add', payload => handleQueueAdd(socket, payload));
    socket.on('room:queue:advance', payload => handleQueueAdvance(socket, payload));
    socket.on('dm:send', payload => handleDirectMessage(socket, payload));

    socket.on('disconnect', () => unregisterSocket(socket));
  });

  return io;
}

// ─── Gestion de la connexion globale ───────────────────────────────────────

function registerSocket(socket) {
  if (!connectedSockets.has(socket.userId)) {
    connectedSockets.set(socket.userId, new Set());
  }
  connectedSockets.get(socket.userId).add(socket.id);
}

function unregisterSocket(socket) {
  connectedSockets.get(socket.userId)?.delete(socket.id);
  if (connectedSockets.get(socket.userId)?.size === 0) {
    connectedSockets.delete(socket.userId);
  }

  // Retire l'utilisateur de la présence de tous les salons où il était
  for (const [roomId, presence] of roomPresence.entries()) {
    if (presence.has(socket.userId)) {
      presence.delete(socket.userId);
      broadcastPresence(roomId);
    }
  }
}

// ─── Salon : join / leave ───────────────────────────────────────────────────

async function handleRoomJoin(socket, { roomId, username, avatarUrl }) {
  if (!roomId) return;

  socket.join(roomKey(roomId));

  if (!roomPresence.has(roomId)) {
    roomPresence.set(roomId, new Map());
  }
  roomPresence.get(roomId).set(socket.userId, {
    username: username ?? 'Utilisateur',
    avatarUrl: avatarUrl ?? null,
  });

  socket.currentRoomId = roomId;
  broadcastPresence(roomId);
}

function handleRoomLeave(socket, { roomId }) {
  if (!roomId) return;

  socket.leave(roomKey(roomId));
  roomPresence.get(roomId)?.delete(socket.userId);
  socket.currentRoomId = null;
  broadcastPresence(roomId);
}

function broadcastPresence(roomId) {
  const presence = roomPresence.get(roomId);
  const users = presence
    ? Array.from(presence.entries()).map(([userId, info]) => ({ userId, ...info }))
    : [];

  io.to(roomKey(roomId)).emit('room:presence', users);
}

// ─── Chat de salon ───────────────────────────────────────────────────────────

async function handleRoomMessage(socket, { roomId, text }) {
  if (!roomId || !text?.trim()) return;

  try {
    const message = await messageService.sendMessage(socket.userId, {
      roomId,
      text: text.trim(),
    });
    io.to(roomKey(roomId)).emit('room:message:new', message);
  } catch (err) {
    socket.emit('error', { message: err.message || "Échec de l'envoi du message." });
  }
}

// ─── Queue de salon ──────────────────────────────────────────────────────────

async function handleQueueAdd(socket, { roomId, trackId }) {
  if (!roomId || !trackId) return;

  try {
    await roomService.addTrackToQueue(roomId, socket.userId, trackId);
    const room = await roomService.getRoomDetail(roomId);
    io.to(roomKey(roomId)).emit('room:queue:updated', room);
  } catch (err) {
    socket.emit('error', { message: err.message || "Échec de l'ajout à la file." });
  }
}

async function handleQueueAdvance(socket, { roomId }) {
  if (!roomId) return;

  try {
    await roomService.advanceQueue(roomId);
    const room = await roomService.getRoomDetail(roomId);
    io.to(roomKey(roomId)).emit('room:queue:updated', room);
  } catch (err) {
    socket.emit('error', { message: err.message || "Échec du passage au morceau suivant." });
  }
}

// ─── Messages privés (DM) ────────────────────────────────────────────────────
// Contrairement au chat de salon (broadcast à une room Socket.io), un DM
// doit être livré uniquement aux sockets du destinataire précis. On utilise
// la map connectedSockets pour retrouver ses connexions actives ; s'il est
// hors ligne, le message reste en BDD et sera récupéré au prochain GET
// /messages/private/:userId côté front.

async function handleDirectMessage(socket, { toUserId, text }) {
  if (!toUserId || !text?.trim()) return;

  try {
    const message = await messageService.sendMessage(socket.userId, {
      toUserId,
      text: text.trim(),
    });

    // Livre à l'expéditeur (confirmation) et au destinataire s'il est en ligne
    socket.emit('dm:new', message);

    const recipientSocketIds = connectedSockets.get(toUserId);
    if (recipientSocketIds) {
      for (const socketId of recipientSocketIds) {
        io.to(socketId).emit('dm:new', message);
      }
    }
  } catch (err) {
    socket.emit('error', { message: err.message || "Échec de l'envoi du message privé." });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roomKey(roomId) {
  return `room:${roomId}`;
}

function getIo() {
  if (!io) {
    throw new Error('Socket.io n\'a pas encore été initialisé. Appelle initSocketServer() au démarrage.');
  }
  return io;
}

module.exports = { initSocketServer, getIo };