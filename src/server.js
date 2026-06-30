require('dotenv').config();

const http = require('http');
const app = require('./app');
const { initSocketServer } = require('./sockets/socketServer');

const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Socket.io a besoin de s'attacher à un serveur HTTP explicite plutôt
// qu'à l'app Express directement (app.listen() en crée un en interne,
// mais sans nous le rendre accessible pour y attacher Socket.io).
const httpServer = http.createServer(app);

initSocketServer(httpServer, { allowedOrigins });

httpServer.listen(PORT, () => {
  console.log(`[near-api] serveur démarré sur le port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
  console.log(`[near-api] Socket.io prêt sur le même port`);
});

process.on('unhandledRejection', err => {
  console.error('[unhandledRejection]', err);
});

process.on('uncaughtException', err => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});