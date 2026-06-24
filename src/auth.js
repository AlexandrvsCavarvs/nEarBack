const { supabaseAdmin } = require('../config/supabase');

/**
 * Vérifie le token JWT envoyé par le client (header Authorization: Bearer <token>)
 * Ce token est émis par Supabase Auth côté mobile lors du login.
 * En cas de succès, attache req.user (objet utilisateur Supabase) à la requête.
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
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Token invalide ou expiré.',
      });
    }

    req.user = data.user; // { id, email, ... }
    req.userId = data.user.id;
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
 * req.user si le token est présent et valide. Utile pour des routes
 * publiques avec contenu personnalisé optionnel.
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
    const { data } = await supabaseAdmin.auth.getUser(token);
    req.user = data?.user ?? null;
    req.userId = data?.user?.id ?? null;
  } catch {
    req.user = null;
    req.userId = null;
  }

  next();
}

module.exports = { requireAuth, optionalAuth };