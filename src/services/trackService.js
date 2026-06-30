const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middlewares/errorHandler');

async function searchTracks(query) {
  const { data, error } = await supabaseAdmin
    .from('tracks')
    .select(
      `
      id, title, cover_url,
      artists:artist_id ( id, name ),
      albums:album_id ( id, title ),
      genres:genre ( genre_label )
    `
    )
    .ilike('title', `%${query}%`)
    .limit(30);

  if (error) {
    throw new AppError(500, 'track_search_failed', error.message);
  }

  return data;
}

/**
 * Enregistre une écoute dans l'historique. Appelé par le mobile quand
 * l'utilisateur commence à écouter un morceau (salon ou perso).
 */
async function recordListen(userId, trackId) {
  const { data, error } = await supabaseAdmin
    .from('user_tracks_history')
    .insert({
      user_id: userId,
      track_id: trackId,
      played_at: new Date().toISOString(),
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw new AppError(400, 'listen_record_failed', error.message);
  }

  return data;
}

/**
 * Like d'un morceau écouté par un autre utilisateur (depuis son profil
 * ou la carte). Contraint par unicité (track, liked_by, owner) côté BDD.
 */
async function likeTrack(likedByUserId, ownerUserId, trackId) {
  if (likedByUserId === ownerUserId) {
    throw new AppError(400, 'invalid_like', 'Impossible de liker sa propre écoute.');
  }

  const { data, error } = await supabaseAdmin
    .from('track_likes')
    .upsert(
      {
        track_id: trackId,
        liked_by_user_id: likedByUserId,
        owner_user_id: ownerUserId,
      },
      { onConflict: 'track_id,liked_by_user_id,owner_user_id', ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error) {
    throw new AppError(400, 'like_failed', error.message);
  }

  return data;
}

async function unlikeTrack(likedByUserId, ownerUserId, trackId) {
  const { error } = await supabaseAdmin
    .from('track_likes')
    .delete()
    .eq('track_id', trackId)
    .eq('liked_by_user_id', likedByUserId)
    .eq('owner_user_id', ownerUserId);

  if (error) {
    throw new AppError(400, 'unlike_failed', error.message);
  }

  return { unliked: true };
}

/**
 * Trace un clic : utilisateur A clique sur le morceau que B écoute
 * (depuis la carte ou un salon). Sert de signal d'engagement/découverte.
 */
async function recordClick(fromUserId, toUserId, trackId) {
  if (fromUserId === toUserId) {
    // Pas bloquant, mais inutile -- on l'ignore silencieusement
    return { recorded: false };
  }

  const { error } = await supabaseAdmin.from('click_events').insert({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    track_id: trackId,
  });

  if (error) {
    throw new AppError(400, 'click_record_failed', error.message);
  }

  return { recorded: true };
}

module.exports = {
  searchTracks,
  recordListen,
  likeTrack,
  unlikeTrack,
  recordClick,
};