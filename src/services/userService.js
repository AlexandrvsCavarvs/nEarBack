const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Récupère le profil public d'un utilisateur, enrichi de ses stats
 * (écoutes, likes reçus, morceau en cours).
 */
async function getUserProfile(userId) {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select(
      `
      id, username, avatar_url, banner_url, preferences, country,
      countries:country ( name )
    `
    )
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new AppError(404, 'user_not_found', 'Utilisateur introuvable.');
  }

  const [{ count: playsCount }, { count: likesCount }, currentTrack] =
    await Promise.all([
      supabaseAdmin
        .from('user_tracks_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabaseAdmin
        .from('track_likes')
        .select('id', { count: 'exact', head: true })
        .eq('owner_user_id', userId),
      getCurrentlyPlaying(userId),
    ]);

  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatar_url,
    bannerUrl: user.banner_url,
    preferences: user.preferences,
    country: user.countries?.name ?? null,
    stats: {
      plays: playsCount ?? 0,
      likes: likesCount ?? 0,
    },
    currentTrack,
  };
}

/**
 * Détermine le morceau "actuellement écouté" par un utilisateur :
 * dernière entrée dans user_tracks_history, considérée "live" si récente
 * (moins de 10 minutes), sinon null.
 */
async function getCurrentlyPlaying(userId) {
  const { data, error } = await supabaseAdmin
    .from('user_tracks_history')
    .select(
      `
      played_at,
      tracks:track_id (
        id, title, cover_url,
        artists:artist_id ( name ),
        albums:album_id ( title ),
        genres:genre ( genre_label )
      )
    `
    )
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const playedAt = new Date(data.played_at);
  const isRecent = Date.now() - playedAt.getTime() < 10 * 60 * 1000;
  if (!isRecent) return null;

  return {
    id: data.tracks.id,
    title: data.tracks.title,
    coverUrl: data.tracks.cover_url,
    artist: data.tracks.artists?.name ?? 'Artiste inconnu',
    album: data.tracks.albums?.title ?? null,
    genre: data.tracks.genres?.genre_label ?? null,
  };
}

async function updateUserProfile(userId, updates) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new AppError(400, 'update_failed', error.message);
  }

  return data;
}

/**
 * Recherche d'utilisateurs par pseudo (insensible à la casse, partiel).
 */
async function searchUsers(query, excludeUserId) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, username, avatar_url')
    .ilike('username', `%${query}%`)
    .neq('id', excludeUserId)
    .limit(20);

  if (error) {
    throw new AppError(500, 'search_failed', error.message);
  }

  return data;
}

module.exports = {
  getUserProfile,
  getCurrentlyPlaying,
  updateUserProfile,
  searchUsers,
};