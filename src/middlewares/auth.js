const authService = require('../services/authService');

/**
 * Vérifie le token JWT envoyé par le client (header Authorization: Bearer <token>).
 * Ce token est émis par /api/auth/signin ou /api/auth/signup côté front.
 * Délègue la vérification à authService, qui est le seul point de contact
 * avec le provider d'auth réel (Supabase aujourd'hui, autre chose demain).
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Token manquant. Header attendu : Authorization: Bearer <token>',
    });
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const user = await authService.verifyAccessToken(token);

    if (!user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Token invalide ou expiré.',
      });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    console.error('[requireAuth] erreur de vérification du token:', err.message);
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Impossible de vérifier le token.',
    });
  }
}

/**
 * Variante optionnelle : n'échoue pas si pas de token, mais attache
 * req.user si le token est présent et valide.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    req.userId = null;
    return next();
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const user = await authService.verifyAccessToken(token);
    req.user = user;
    req.userId = user?.id ?? null;
  } catch {
    req.user = null;
    req.userId = null;
  }

  next();
}

module.exports = { requireAuth, optionalAuth };