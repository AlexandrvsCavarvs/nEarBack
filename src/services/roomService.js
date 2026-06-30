const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Crée un salon et y inscrit automatiquement son créateur comme host.
 */
async function createRoom(hostUserId, { room_name, is_private }) {
  const { data: room, error } = await supabaseAdmin
    .from('rooms')
    .insert({
      host_user_id: hostUserId,
      room_name,
      is_private,
      is_active: true,
      created_by: hostUserId,
    })
    .select()
    .single();

  if (error) {
    throw new AppError(400, 'room_create_failed', error.message);
  }

  const { error: participantError } = await supabaseAdmin
    .from('room_participants')
    .insert({
      room_id: room.id,
      user_id: hostUserId,
      is_host: true,
      is_admin: true,
    });

  if (participantError) {
    // Rollback manuel : le salon a été créé mais l'inscription du host a échoué
    await supabaseAdmin.from('rooms').delete().eq('id', room.id);
    throw new AppError(
      400,
      'room_create_failed',
      'Impossible d\'inscrire le créateur dans le salon.'
    );
  }

  return room;
}

/**
 * Liste les salons publics actifs (pour le lobby / recherche).
 */
async function listPublicRooms() {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select(
      `
      id, room_name, is_active, created_at,
      host:host_user_id ( id, username, avatar_url ),
      current_track:current_track_id (
        id, title, cover_url,
        artists:artist_id ( name )
      ),
      room_participants ( id )
    `
    )
    .eq('is_private', false)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'rooms_fetch_failed', error.message);
  }

  return data.map(room => ({
    id: room.id,
    name: room.room_name,
    host: room.host,
    currentTrack: room.current_track
      ? {
          id: room.current_track.id,
          title: room.current_track.title,
          coverUrl: room.current_track.cover_url,
          artist: room.current_track.artists?.name ?? null,
        }
      : null,
    participantCount: room.room_participants?.length ?? 0,
  }));
}

async function getRoomDetail(roomId) {
  const { data: room, error } = await supabaseAdmin
    .from('rooms')
    .select(
      `
      id, room_name, is_active, is_private, created_at,
      host:host_user_id ( id, username, avatar_url ),
      current_track:current_track_id (
        id, title, cover_url,
        artists:artist_id ( name ),
        albums:album_id ( title ),
        genres:genre ( genre_label )
      )
    `
    )
    .eq('id', roomId)
    .single();

  if (error || !room) {
    throw new AppError(404, 'room_not_found', 'Salon introuvable.');
  }

  const { data: participants, error: participantsError } = await supabaseAdmin
    .from('room_participants')
    .select('id, is_host, is_admin, joined_at, users:user_id ( id, username, avatar_url )')
    .eq('room_id', roomId);

  if (participantsError) {
    throw new AppError(500, 'participants_fetch_failed', participantsError.message);
  }

  const { data: queue, error: queueError } = await supabaseAdmin
    .from('room_queue')
    .select(
      `
      id, position, played, added_at,
      tracks:track_id ( id, title, cover_url, artists:artist_id ( name ) ),
      added_by_user:added_by ( id, username, avatar_url )
    `
    )
    .eq('room_id', roomId)
    .eq('played', false)
    .order('position', { ascending: true });

  if (queueError) {
    throw new AppError(500, 'queue_fetch_failed', queueError.message);
  }

  return {
    id: room.id,
    name: room.room_name,
    isActive: room.is_active,
    isPrivate: room.is_private,
    host: room.host,
    currentTrack: room.current_track,
    participants: participants.map(p => ({
      ...p.users,
      isHost: p.is_host,
      isAdmin: p.is_admin,
      joinedAt: p.joined_at,
    })),
    queue: queue.map(q => ({
      id: q.id,
      position: q.position,
      track: q.tracks,
      addedBy: q.added_by_user,
      addedAt: q.added_at,
    })),
  };
}

async function joinRoom(roomId, userId) {
  const { data: room } = await supabaseAdmin
    .from('rooms')
    .select('id, is_active')
    .eq('id', roomId)
    .single();

  if (!room || !room.is_active) {
    throw new AppError(404, 'room_not_found', 'Ce salon est introuvable ou fermé.');
  }

  const { error } = await supabaseAdmin
    .from('room_participants')
    .upsert(
      { room_id: roomId, user_id: userId },
      { onConflict: 'room_id,user_id', ignoreDuplicates: true }
    );

  if (error) {
    throw new AppError(400, 'join_failed', error.message);
  }

  return { joined: true };
}

async function leaveRoom(roomId, userId) {
  const { error } = await supabaseAdmin
    .from('room_participants')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (error) {
    throw new AppError(400, 'leave_failed', error.message);
  }

  return { left: true };
}

/**
 * Ajoute un morceau à la file d'attente d'un salon, à la position suivante.
 */
async function addTrackToQueue(roomId, userId, trackId) {
  const { data: lastItem } = await supabaseAdmin
    .from('room_queue')
    .select('position')
    .eq('room_id', roomId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (lastItem?.position ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from('room_queue')
    .insert({
      room_id: roomId,
      track_id: trackId,
      queued_by: userId,
      added_by: userId,
      position: nextPosition,
      played: false,
    })
    .select(
      `
      id, position,
      tracks:track_id ( id, title, cover_url, artists:artist_id ( name ) )
    `
    )
    .single();

  if (error) {
    throw new AppError(400, 'queue_add_failed', error.message);
  }

  return data;
}

/**
 * Passe au morceau suivant : marque l'item courant comme joué,
 * met à jour rooms.current_track_id avec le prochain de la file.
 */
async function advanceQueue(roomId) {
  const { data: next, error: nextError } = await supabaseAdmin
    .from('room_queue')
    .select('id, track_id')
    .eq('room_id', roomId)
    .eq('played', false)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextError) {
    throw new AppError(500, 'queue_advance_failed', nextError.message);
  }

  if (!next) {
    // Plus rien dans la file
    await supabaseAdmin
      .from('rooms')
      .update({ current_track_id: null })
      .eq('id', roomId);
    return { currentTrack: null };
  }

  await supabaseAdmin
    .from('room_queue')
    .update({ played: true })
    .eq('id', next.id);

  await supabaseAdmin
    .from('rooms')
    .update({ current_track_id: next.track_id })
    .eq('id', roomId);

  return { currentTrackId: next.track_id };
}

async function inviteUserToRoom(roomId, invitedUserId) {
  // Pour l'instant : ajout direct comme participant.
  // Si tu veux un vrai système d'invitation avec accept/refuse,
  // il faudrait une table dédiée (room_invitations) -- absente du schéma actuel.
  return joinRoom(roomId, invitedUserId);
}

async function closeRoom(roomId, requesterId) {
  const { data: room } = await supabaseAdmin
    .from('rooms')
    .select('host_user_id')
    .eq('id', roomId)
    .single();

  if (!room) {
    throw new AppError(404, 'room_not_found', 'Salon introuvable.');
  }

  if (room.host_user_id !== requesterId) {
    throw new AppError(403, 'forbidden', 'Seul le créateur du salon peut le fermer.');
  }

  const { error } = await supabaseAdmin
    .from('rooms')
    .update({ is_active: false })
    .eq('id', roomId);

  if (error) {
    throw new AppError(400, 'close_failed', error.message);
  }

  return { closed: true };
}

module.exports = {
  createRoom,
  listPublicRooms,
  getRoomDetail,
  joinRoom,
  leaveRoom,
  addTrackToQueue,
  advanceQueue,
  inviteUserToRoom,
  closeRoom,
};