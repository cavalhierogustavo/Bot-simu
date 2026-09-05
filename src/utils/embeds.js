const { EmbedBuilder } = require('discord.js');
const { mention, truncate } = require('./helpers');

function slotText(simulado) {
  if (simulado.modo === '1v1') {
    return simulado.participantes.map((id, index) => `${index + 1}. ${mention(id)}`).join('\n') || 'Nenhum participante';
  }
  const capacity = Number(simulado.modo[0]);
  return simulado.equipes.map((team) => `${team.nome} (${team.membros.length}/${capacity})\n${team.membros.map((id) => mention(id)).join(' | ') || 'Vazio'}`).join('\n\n') || 'Nenhuma equipe';
}

/**
 * Cria embed para a página principal do simulado/torneio
 */
function simuladoEmbed(simulado) {
  const embed = new EmbedBuilder()
    .setColor(simulado.status === 'aberto' ? 0x3498db : simulado.status === 'em_andamento' ? 0xe67e22 : 0x2ecc71)
    .setTitle(`🏆 ${simulado.nome}`)
    .setDescription('Clique em **Entrar** para participar do torneio.\n\nQuando estiver tudo pronto, a organização clica em **Iniciar Torneio**.\n\nA organização pode remover participantes pelo botão **Expulsar participante**.')
    .addFields(
      { name: '⚙️ Modo', value: simulado.modo, inline: true },
      { name: '🎟️ Vagas', value: `${simulado.participantes.length}/${simulado.vagas}`, inline: true },
      { name: '👥 Status', value: simulado.status === 'aberto' ? '🟢 Aberto' : simulado.status === 'em_andamento' ? '🟡 Em andamento' : '🏁 Finalizado', inline: true },
      { name: '👥 Participantes', value: truncate(slotText(simulado), 1024), inline: false }
    )
    .setFooter({ text: `Criado por ${simulado.criador.nome} • ${new Date(simulado.criadoEm).toLocaleDateString('pt-BR')}`, iconURL: null })
    .setTimestamp();
  
  return embed;
}

/**
 * Cria embed para um confronto individual
 */
function matchEmbed(match, simulado, player1DisplayName = null, player2DisplayName = null) {
  const votosCount = Object.values(match.votos).reduce((acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }), {});
  
  // Fallback para nomes se não fornecidos
  const p1Name = player1DisplayName || match.participantNames[0];
  const p2Name = player2DisplayName || match.participantNames[1];
  
  let description = `🔵 ${mention(typeof match.participante1 === 'string' ? match.participante1 : match.participante1.membros[0])}\n`;
  description += `🆚\n`;
  description += `🔴 ${mention(typeof match.participante2 === 'string' ? match.participante2 : match.participante2.membros[0])}\n\n`;
  
  if (match.status === 'aberto') {
    description += `**📊 Votos atuais:**\n`;
    description += `${p1Name}: ${votosCount[0] || 0} voto${votosCount[0] !== 1 ? 's' : ''}\n`;
    description += `${p2Name}: ${votosCount[1] || 0} voto${votosCount[1] !== 1 ? 's' : ''}`;
  } else if (match.status === 'finalizado') {
    const winner = match.vencedor === 0 ? p1Name : p2Name;
    description += `**🏆 Vencedor:**\n${winner}`;
  } else if (match.status === 'divergente') {
    description += `**⚠️ Votos divergentes**\n`;
    description += `A organização precisa decidir o resultado.`;
  }

  return new EmbedBuilder()
    .setColor(match.status === 'aberto' ? 0x3498db : match.status === 'finalizado' ? 0x2ecc71 : match.status === 'divergente' ? 0xe74c3c : 0xe67e22)
    .setTitle(`⚔️ Confronto #${match.id.replace('match_', '')}`)
    .setDescription(description)
    .setFooter({ text: `Rodada ${match.rodada} • ${match.status === 'aberto' ? '🟢 Aberto' : match.status === 'finalizado' ? '✅ Finalizado' : '⚠️ Divergente'}` })
    .setTimestamp();
}

/**
 * Cria embed para resultado de uma rodada
 */
function roundResultsEmbed(results, roundNumber) {
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`🏆 RODADA ${roundNumber} FINALIZADA!`)
    .setDescription('✅ Todos os resultados foram registrados.\n\n➡️ **Próxima rodada sendo preparada...**')
    .addFields(
      { name: '📊 Resultados', value: results.length > 0 ? results.join('\n') : 'Nenhum resultado', inline: false }
    );
  
  return embed;
}

/**
 * Cria embed para o vencedor final
 */
function finalWinnerEmbed(winnerMention, tournamentName) {
  return new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle('🏆 TORNEIO FINALIZADO!')
    .addFields(
      { name: '👑 CAMPEÃO', value: winnerMention, inline: false },
      { name: '🎉', value: 'Parabéns ao campeão!', inline: false }
    )
    .setFooter({ text: `Torneio: ${tournamentName}` })
    .setTimestamp();
}

/**
 * Cria embed para status de uma rodada
 */
function roundStatusEmbed(roundNumber, totalMatches, finishedMatches) {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`📊 Status da Rodada ${roundNumber}`)
    .setDescription(`\`${finishedMatches}/${totalMatches}\` confrontos finalizados`)
    .setTimestamp();
}

module.exports = { 
  simuladoEmbed, 
  slotText, 
  matchEmbed,
  roundResultsEmbed,
  finalWinnerEmbed,
  roundStatusEmbed
};
