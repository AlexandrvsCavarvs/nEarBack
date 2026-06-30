const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Liste les amis acceptés d'un utilisateur (relation bidirectionnelle :
 * la table friends stocke une ligne user_id -> friend_id, on regarde
 * dans les deux sens pour savoir qui est "ami" de qui).
 */
async function listFriends(userId) {
  const { data, error } = await supabaseAdmin
    .from('friends')
    .select(
      `
      id, status, user_id, friend_id,
      requester:user_id ( id, username, avatar_url ),
      target:friend_id ( id, username, avatar_url )
    `
    )
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) {
    throw new AppError(500, 'friends_fetch_failed', error.message);
  }

  return data.map(row => {
    const friend = row.user_id === userId ? row.target : row.requester;
    return { friendshipId: row.id, ...friend };
  });
}

async function listPendingRequests(userId) {
  const { data, error } = await supabaseAdmin
    .from('friends')
    .select(
      `
      id, created_at,
      requester:user_id ( id, username, avatar_url )
    `
    )
    .eq('friend_id', userId)
    .eq('status', 'pending');

  if (error) {
    throw new AppError(500, 'pending_fetch_failed', error.message);
  }

  return data.map(row => ({
    friendshipId: row.id,
    requestedAt: row.created_at,
    user: row.requester,
  }));
}

async function sendFriendRequest(userId, friendId) {
  if (userId === friendId) {
    throw new AppError(400, 'invalid_request', "Impossible de s'ajouter soi-même.");
  }

  // Vérifie qu'une relation n'existe pas déjà dans un sens ou l'autre
  const { data: existing } = await supabaseAdmin
    .from('friends')
    .select('id, status')
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
    )
    .maybeSingle();

  if (existing) {
    throw new AppError(
      409,
      'request_exists',
      `Une relation existe déjà entre ces utilisateurs (statut : ${existing.status}).`
    );
  }

  const { data, error } = await supabaseAdmin
    .from('friends')
    .insert({
      user_id: userId,
      friend_id: friendId,
      status: 'pending',
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw new AppError(400, 'request_failed', error.message);
  }

  return data;
}

/**
 * Répond à une demande d'ami (accepter ou bloquer). Seul le destinataire
 * (friend_id) peut répondre.
 */
async function respondToRequest(friendshipId, responderId, status) {
  const { data: request } = await supabaseAdmin
    .from('friends')
    .select('id, friend_id')
    .eq('id', friendshipId)
    .single();

  if (!request) {
    throw new AppError(404, 'request_not_found', 'Demande introuvable.');
  }

  if (request.friend_id !== responderId) {
    throw new AppError(403, 'forbidden', "Tu n'es pas destinataire de cette demande.");
  }

  const { data, error } = await supabaseAdmin
    .from('friends')
    .update({
      status,
      updated_at: new Date().toISOString(),
      updated_by: responderId,
    })
    .eq('id', friendshipId)
    .select()
    .single();

  if (error) {
    throw new AppError(400, 'respond_failed', error.message);
  }

  return data;
}

async function removeFriend(friendshipId, requesterId) {
  const { data: row } = await supabaseAdmin
    .from('friends')
    .select('user_id, friend_id')
    .eq('id', friendshipId)
    .single();

  if (!row) {
    throw new AppError(404, 'friendship_not_found', 'Relation introuvable.');
  }

  if (row.user_id !== requesterId && row.friend_id !== requesterId) {
    throw new AppError(403, 'forbidden', "Tu ne fais pas partie de cette relation.");
  }

  const { error } = await supabaseAdmin.from('friends').delete().eq('id', friendshipId);

  if (error) {
    throw new AppError(400, 'remove_failed', error.message);
  }

  return { removed: true };
}

module.exports = {
  listFriends,
  listPendingRequests,
  sendFriendRequest,
  respondToRequest,
  removeFriend,
};