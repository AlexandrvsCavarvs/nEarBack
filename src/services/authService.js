const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Ce service est le SEUL point de contact avec Supabase Auth dans toute
 * l'application. Le front ne sait pas que Supabase existe -- il ne parle
 * qu'à /api/auth/*. Si un jour tu changes de provider (Auth0, Firebase,
 * JWT maison...), seul ce fichier doit changer.
 */

async function signUp({ email, password, username }) {
  const { data, error } = await supabaseAdmin.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) {
    throw new AppError(400, 'signup_failed', error.message);
  }

  // Crée la ligne correspondante dans la table applicative `users`.
  // Le trigger Supabase classique (auth.users -> public.users) est une
  // alternative, mais on le fait ici explicitement pour rester visible
  // et indépendant d'une config DB cachée.
  if (data.user) {
    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: data.user.id,
      email,
      password: 'managed_by_auth_provider', // jamais utilisé, Supabase Auth gère le hash réel
      username,
      created_by: data.user.id,
    });

    // Si la ligne existe déjà (re-tentative), ce n'est pas bloquant.
    if (profileError && profileError.code !== '23505') {
      console.error('[authService.signUp] échec création profil:', profileError.message);
    }
  }

  return {
    user: data.user ? { id: data.user.id, email: data.user.email } : null,
    session: data.session
      ? {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
        }
      : null,
    // Si null, l'email de confirmation est requis avant de pouvoir se connecter
    requiresEmailConfirmation: !data.session,
  };
}

async function signIn({ email, password }) {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

  if (error) {
    throw new AppError(401, 'invalid_credentials', 'Email ou mot de passe incorrect.');
  }

  return {
    user: { id: data.user.id, email: data.user.email },
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    },
  };
}

async function refreshSession(refreshToken) {
  const { data, error } = await supabaseAdmin.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    throw new AppError(401, 'invalid_refresh_token', 'Session expirée, reconnecte-toi.');
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
  };
}

async function signOut(accessToken) {
  // Invalide le refresh token côté Supabase. Le front doit aussi
  // supprimer le token stocké localement de son côté.
  const { error } = await supabaseAdmin.auth.admin.signOut(accessToken);
  if (error) {
    // Non bloquant : le token expirera de toute façon.
    console.warn('[authService.signOut] échec invalidation token:', error.message);
  }
  return { signedOut: true };
}

/**
 * Vérifie un access token et retourne l'utilisateur Supabase associé.
 * Utilisé par le middleware d'auth REST ET par le middleware Socket.io.
 */
async function verifyAccessToken(token) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }
  return data.user;
}

module.exports = { signUp, signIn, refreshSession, signOut, verifyAccessToken };