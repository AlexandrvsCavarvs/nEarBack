const { supabaseAdmin } = require('../config/supabase');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Envoie un message. Cible soit un salon (roomId), soit un utilisateur
 * (toUserId) -- jamais les deux, jamais aucun (contrainte reflétée en BDD).
 * Note : l'écriture seule suffit ici, la diffusion temps réel aux autres
 * clients est gérée par Supabase Realtime côté mobile (postgres_changes
 * sur la table messages), pas par ce backend.
 */
async function sendMessage(fromUserId, { roomId, toUserId, text }) {
  if (!roomId && !toUserId) {
    throw new AppError(400, 'invalid_target', 'Un message doit cibler un salon ou un utilisateur.');
  }
  if (roomId && toUserId) {
    throw new AppError(400, 'invalid_target', 'Un message ne peut pas cibler à la fois un salon et un utilisateur.');
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      from_user_id: fromUserId,
      room_id: roomId ?? null,
      to_user_id: toUserId ?? null,
      message: text,
    })
    .select(
      `
      id, message, created_at,
      sender:from_user_id ( id, username, avatar_url )
    `
    )
    .single();

  if (error) {
    throw new AppError(400, 'message_send_failed', error.message);
  }

  return data;
}

async function getRoomMessages(roomId, { limit = 50, before } = {}) {
  let q = supabaseAdmin
    .from('messages')
    .select(
      `
      id, message, created_at, is_deleted,
      sender:from_user_id ( id, username, avatar_url )
    `
    )
    .eq('room_id', roomId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    q = q.lt('created_at', before);
  }

  const { data, error } = await q;

  if (error) {
    throw new AppError(500, 'messages_fetch_failed', error.message);
  }

  return data.reverse(); // ordre chronologique pour l'affichage
}

async function getPrivateConversation(userId, otherUserId, { limit = 50, before } = {}) {
  let q = supabaseAdmin
    .from('messages')
    .select(
      `
      id, message, created_at, is_deleted,
      sender:from_user_id ( id, username, avatar_url ),
      to_user_id
    `
    )
    .or(
      `and(from_user_id.eq.${userId},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${userId})`
    )
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    q = q.lt('created_at', before);
  }

  const { data, error } = await q;

  if (error) {
    throw new AppError(500, 'conversation_fetch_failed', error.message);
  }

  return data.reverse();
}

async function deleteMessage(messageId, requesterId) {
  const { data: msg } = await supabaseAdmin
    .from('messages')
    .select('from_user_id')
    .eq('id', messageId)
    .single();

  if (!msg) {
    throw new AppError(404, 'message_not_found', 'Message introuvable.');
  }

  if (msg.from_user_id !== requesterId) {
    throw new AppError(403, 'forbidden', "Tu ne peux supprimer que tes propres messages.");
  }

  const { error } = await supabaseAdmin
    .from('messages')
    .update({ is_deleted: true })
    .eq('id', messageId);

  if (error) {
    throw new AppError(400, 'delete_failed', error.message);
  }

  return { deleted: true };
}

module.exports = {
  sendMessage,
  getRoomMessages,
  getPrivateConversation,
  deleteMessage,
};