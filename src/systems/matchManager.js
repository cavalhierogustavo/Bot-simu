const { ChannelType, PermissionFlagsBits } = require('discord.js');
const store = require('./jsonManager');
const { nextId } = store;
const { shuffle } = require('../utils/helpers');
const { matchButtons } = require('../utils/buttons');
const { matchEmbed } = require('../utils/embeds');
const { EmbedBuilder } = require('discord.js');

function members(participant) { return typeof participant === 'string' ? [participant] : participant.membros; }
function names(participant) { return members(participant).map((id) => `<@${id}>`).join(', '); }

async function createRound(simulado, client) {
  const participants = simulado.rodadaAtual === 1 ? (simulado.modo === '1v1' ? shuffle(simulado.participantes) : shuffle(simulado.equipes.filter((team) => team.membros.length))) : simulado._nextParticipants;
  const roundMatches = [];
  for (let index = 0; index < participants.length; index += 2) {
    if (!participants[index + 1]) break;
    const id = await nextId('match');
    const match = { id, simuladoId: simulado.id, rodada: simulado.rodadaAtual, participante1: participants[index], participante2: participants[index + 1], participantNames: [names(participants[index]), names(participants[index + 1])], votos: {}, vencedor: null, status: 'aberto', canalId: null, creatorId: simulado.criador.id };
    const guild = await client.guilds.fetch(simulado._guildId);
    const channel = await guild.channels.create({ name: `confronto-${id.replace('match_', '')}`, type: ChannelType.GuildText, permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }, ...[...new Set([...members(participants[index]), ...members(participants[index + 1]), simulado.criador.id])].map((userId) => ({ id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }))] });
    match.canalId = channel.id;
    const message = await channel.send({ embeds: [matchEmbed(match, simulado)], components: matchButtons(match, simulado.criador.id) });
    match.messageId = message.id; 
    roundMatches.push(match);
  }
  simulado.confrontos.push(...roundMatches); 
  await store.update('simulados', (items) => items.map((item) => item.id === simulado.id ? simulado : item)); 
  
  // Enviar mensagem de confrontos no chat principal
  const mainChannel = await client.channels.fetch(simulado.canalId);
  let bracketText = `🏆 **TORNEIO — RODADA ${simulado.rodadaAtual}**\n\n`;
  roundMatches.forEach((m, idx) => {
    bracketText += `⚔️ ${m.participantNames[0]} vs ${m.participantNames[1]}\n`;
  });
  await mainChannel.send({ embeds: [new EmbedBuilder().setColor(0x3498db).setTitle(`Rodada ${simulado.rodadaAtual}`).setDescription(bracketText)] });
  
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
  
  await store.update('jogadores', (players) => {
    const finished = current.flatMap((match) => [members(match.participante1), members(match.participante2)]);
    return players.map((player) => {
      const result = current.find((match) => members(match.participante1).includes(player.userId) || members(match.participante2).includes(player.userId));
      if (!result) return player;
      const won = members(result.vencedor === 0 ? result.participante1 : result.participante2).includes(player.userId);
      return { ...player, vitorias: (player.vitorias || 0) + (won ? 1 : 0), derrotas: (player.derrotas || 0) + (won ? 0 : 1), simuladosParticipados: player.simuladosParticipados || [] };
    });
  });
  
  // Enviar resultado dos confrontos em uma única mensagem
  const mainChannel = await client.channels.fetch(simulado.canalId);
  let resultText = `Resultados da Rodada ${simulado.rodadaAtual}\n\n`;
  current.forEach((m, idx) => {
    const winner = m.vencedor === 0 ? m.participantNames[0] : m.participantNames[1];
    const loser = m.vencedor === 0 ? m.participantNames[1] : m.participantNames[0];
    resultText += `${idx + 1}. ${winner} ▸ ${loser}\n`;
  });
  await mainChannel.send({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle(`Rodada ${simulado.rodadaAtual} Concluída`).setDescription(resultText)] });
  if (winners.length === 1) {
    simulado.vencedor = winners[0]; 
    simulado.status = 'finalizado';
    await store.update('simulados', (items) => items.filter((item) => item.id !== simulado.id));
    await mainChannel.send({ embeds: [new EmbedBuilder().setColor(0xf39c12).setTitle('Simulado Finalizado').setDescription(`Campeão: ${names(winners[0])}`)] });
    return true;
  }
  
  simulado.rodadaAtual += 1; 
  simulado._nextParticipants = winners;
  await store.update('simulados', (items) => items.map((item) => item.id === simulado.id ? simulado : item));
  await createRound(simulado, client);
  return true;
}

module.exports = { createRound, vote, forceWinner, advance, members, deleteMatchChannel };
