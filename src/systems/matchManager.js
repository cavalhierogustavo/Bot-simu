const { ChannelType, PermissionFlagsBits } = require('discord.js');
const store = require('./jsonManager');
const { nextId } = store;
const { shuffle, getPlayerDisplayName, formatMentions } = require('../utils/helpers');
const { matchButtons } = require('../utils/buttons');
const { matchEmbed, roundResultsEmbed, finalWinnerEmbed } = require('../utils/embeds');
const { EmbedBuilder } = require('discord.js');

function members(participant) { return typeof participant === 'string' ? [participant] : participant.membros; }

/**
 * Obtém menções formatadas para um participante
 */
function getMentionString(participant) { 
  return members(participant).map((id) => `<@${id}>`).join(', '); 
}

/**
 * Obtém nomes de exibição para um participante
 */
async function getDisplayNames(participant, guild) {
  const ids = members(participant);
  const names = await Promise.all(
    ids.map((id) => getPlayerDisplayName(id, guild))
  );
  return names.join(' & ');
}


async function createRound(simulado, client) {
  const participants = simulado.rodadaAtual === 1 ? (simulado.modo === '1v1' ? shuffle(simulado.participantes) : shuffle(simulado.equipes.filter((team) => team.membros.length))) : simulado._nextParticipants;
  const roundMatches = [];
  const guild = await client.guilds.fetch(simulado._guildId);
  
  for (let index = 0; index < participants.length; index += 2) {
    if (!participants[index + 1]) break;
    const id = await nextId('match');
    const match = { 
      id, 
      simuladoId: simulado.id, 
      rodada: simulado.rodadaAtual, 
      participante1: participants[index], 
      participante2: participants[index + 1], 
      votos: {}, 
      vencedor: null, 
      status: 'aberto', 
      canalId: null, 
      messageId: null,
      creatorId: simulado.criador.id 
    };
    
    const channel = await guild.channels.create({ 
      name: `confronto-${id.replace('match_', '')}`, 
      type: ChannelType.GuildText, 
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }, 
        ...[...new Set([...members(participants[index]), ...members(participants[index + 1]), simulado.criador.id])].map((userId) => ({ 
          id: userId, 
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] 
        }))
      ] 
    });
    
    match.canalId = channel.id;
    
    // Obter nomes de exibição
    const p1DisplayName = await getDisplayNames(participants[index], guild);
    const p2DisplayName = await getDisplayNames(participants[index + 1], guild);
    
    // Mensagem do confronto
    const message = await channel.send({ 
      content: `${getMentionString(participants[index])} ${getMentionString(participants[index + 1])}`,
      embeds: [matchEmbed(match, simulado, p1DisplayName, p2DisplayName)], 
      components: matchButtons(match, simulado.criador.id, p1DisplayName, p2DisplayName),
      allowedMentions: { users: [...members(participants[index]), ...members(participants[index + 1])] }
    });
    
    match.messageId = message.id;
    roundMatches.push(match);
  }
  
  simulado.confrontos.push(...roundMatches);
  await store.update('simulados', (items) => items.map((item) => item.id === simulado.id ? simulado : item));
  
  // Enviar resumo de confrontos no chat principal
  const mainChannel = await client.channels.fetch(simulado.canalId);
  
  let bracketText = ``;
  for (let i = 0; i < roundMatches.length; i++) {
    const m = roundMatches[i];
    const p1DisplayName = await getDisplayNames(m.participante1, guild);
    const p2DisplayName = await getDisplayNames(m.participante2, guild);
    bracketText += `⚔️ **CONFRONTO ${i + 1}**\n`;
    bracketText += `🔵 ${p1DisplayName}\n`;
    bracketText += `🆚\n`;
    bracketText += `🔴 ${p2DisplayName}\n\n`;
  }
  
  const roundEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🏆 TORNEIO — RODADA ${simulado.rodadaAtual}`)
    .setDescription(bracketText)
    .setFooter({ text: `${roundMatches.length} confrontos • Clique nos links abaixo para votar` })
    .setTimestamp();
  
  await mainChannel.send({ 
    embeds: [roundEmbed],
    content: roundMatches.map((m, i) => `**Confronto ${i + 1}:** <#${m.canalId}>`).join('\n')
  });
  
  return roundMatches;
}

async function vote(match, userId, choice) { 
  if (match.status !== 'aberto') throw new Error('Este confronto já foi finalizado.'); 
  if (!members(match.participante1).concat(members(match.participante2)).includes(userId)) throw new Error('Somente participantes podem votar.'); 
  if (match.votos[userId] !== undefined) throw new Error('Você já votou neste confronto.'); 
  match.votos[userId] = choice; 
  const choices = Object.values(match.votos); 
  const voterCount = members(match.participante1).length + members(match.participante2).length; 
  if (choices.length > 1 && !choices.every((item) => item === choices[0])) match.status = 'divergente'; 
  else if (choices.length === voterCount && choices.every((item) => item === choices[0])) { 
    match.vencedor = choice; 
    match.status = 'finalizado'; 
  } 
  return match; 
}

async function forceWinner(match, creatorId, choice) { 
  if (match.creatorId !== creatorId) throw new Error('Somente o criador pode definir o vencedor.'); 
  match.vencedor = choice; 
  match.status = 'finalizado'; 
  return match; 
}

async function deleteMatchChannel(match, client) {
  if (!match.canalId) return;
  await new Promise((resolve) => setTimeout(resolve, 5000));
  try {
    const channel = await client.channels.fetch(match.canalId);
    await channel?.delete('Confronto finalizado');
  } catch {}
}

async function advance(simulado, client) {
  const current = simulado.confrontos.filter((match) => match.rodada === simulado.rodadaAtual);
  if (!current.length || current.some((match) => match.status !== 'finalizado')) return false;
  
  const winners = current.map((match) => match.vencedor === 0 ? match.participante1 : match.participante2);
  const guild = await client.guilds.fetch(simulado._guildId);
  
  // Atualizar estatísticas de jogadores
  await store.update('jogadores', (players) => {
    const finished = current.flatMap((match) => [members(match.participante1), members(match.participante2)]);
    return players.map((player) => {
      const result = current.find((match) => members(match.participante1).includes(player.userId) || members(match.participante2).includes(player.userId));
      if (!result) return player;
      const won = members(result.vencedor === 0 ? result.participante1 : result.participante2).includes(player.userId);
      return { ...player, vitorias: (player.vitorias || 0) + (won ? 1 : 0), derrotas: (player.derrotas || 0) + (won ? 0 : 1), simuladosParticipados: player.simuladosParticipados || [] };
    });
  });
  
  // Enviar resultados da rodada
  const mainChannel = await client.channels.fetch(simulado.canalId);
  const resultLines = [];
  
  for (let i = 0; i < current.length; i++) {
    const m = current[i];
    const p1DisplayName = await getDisplayNames(m.participante1, guild);
    const p2DisplayName = await getDisplayNames(m.participante2, guild);
    const winner = m.vencedor === 0 ? p1DisplayName : p2DisplayName;
    const loser = m.vencedor === 0 ? p2DisplayName : p1DisplayName;
    resultLines.push(`🏆 ${winner} ▸ ${loser}`);
  }
  
  const resultsEmbed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`✅ RODADA ${simulado.rodadaAtual} CONCLUÍDA`)
    .setDescription(resultLines.join('\n'))
    .setFooter({ text: `${current.length} confrontos finalizados` })
    .setTimestamp();
  
  await mainChannel.send({ embeds: [resultsEmbed] });
  
  // Se houver apenas um vencedor, torneio acabou
  if (winners.length === 1) {
    simulado.vencedor = winners[0];
    simulado.status = 'finalizado';
    
    const winnerMention = getMentionString(winners[0]);
    const winnerEmbed = finalWinnerEmbed(winnerMention, simulado.nome);
    
    await mainChannel.send({ embeds: [winnerEmbed] });
    await store.update('simulados', (items) => items.filter((item) => item.id !== simulado.id));
    
    return true;
  }
  
  // Preparar próxima rodada
  simulado.rodadaAtual += 1;
  simulado._nextParticipants = winners;
  await store.update('simulados', (items) => items.map((item) => item.id === simulado.id ? simulado : item));
  
  // Mensagem de preparo da próxima rodada
  const nextRoundEmbed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`➡️ PRÓXIMA RODADA SENDO PREPARADA...`)
    .setDescription(`Rodada ${simulado.rodadaAtual} vai começar em instantes.`)
    .setTimestamp();
  
  await mainChannel.send({ embeds: [nextRoundEmbed] });
  
  await createRound(simulado, client);
  return true;
}

module.exports = { createRound, vote, forceWinner, advance, members, deleteMatchChannel };
