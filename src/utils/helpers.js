function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function parseIds(value) {
  return Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function mention(id) { return `<@${id}>`; }
function truncate(value, length = 900) { return String(value || '').slice(0, length) || 'Não informado'; }

/**
 * Obtém o nome de exibição de um jogador (apelido do servidor ou username)
 * @param {string|Object} participant - ID de usuário ou objeto de equipe com membros
 * @param {Object} guild - Guild para fetchar membros
 * @returns {Promise<string>} Nome de exibição ou fallback
 */
async function getPlayerDisplayName(participant, guild) {
  try {
    const userId = typeof participant === 'string' ? participant : null;
    if (!userId) return 'Desconhecido';
    
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) return member.displayName || member.user.username;
    
    // Fallback: tentar buscar usuário direto
    const user = await guild.client.users.fetch(userId).catch(() => null);
    return user?.username || userId;
  } catch {
    return 'Desconhecido';
  }
}

/**
 * Obtém nomes de exibição para múltiplos jogadores
 * @param {string[]|Object[]} participantIds - Array de IDs ou objetos de equipe
 * @param {Object} guild - Guild para fetchar membros
 * @returns {Promise<string[]>} Array de nomes de exibição
 */
async function getPlayerDisplayNames(participantIds, guild) {
  return Promise.all(
    participantIds.map((participant) => getPlayerDisplayName(participant, guild))
  );
}

/**
 * Formata array de IDs como menções Discord
 * @param {string[]} ids - Array de IDs de usuário
 * @returns {string} String com menções formatadas
 */
function formatMentions(ids) {
  return ids.map((id) => `<@${id}>`).join(', ');
}

module.exports = { 
  shuffle, 
  parseIds, 
  mention, 
  truncate,
  getPlayerDisplayName,
  getPlayerDisplayNames,
  formatMentions
};
