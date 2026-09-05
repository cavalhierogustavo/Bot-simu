const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

function lobbyButtons(simulado) {
  const buttons = [
    new ButtonBuilder().setCustomId(`sim:join:${simulado.id}`).setLabel('Entrar').setEmoji('🟢').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sim:leave:${simulado.id}`).setLabel('Sair').setEmoji('❌').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`sim:kicklist:${simulado.id}`).setLabel('Expulsar').setEmoji('🗑️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`sim:start:${simulado.id}`).setLabel('Iniciar').setEmoji('🚀').setStyle(ButtonStyle.Danger)
  ];
  if (simulado.modo !== '1v1') {
    buttons.push(new ButtonBuilder().setCustomId(`sim:team:${simulado.id}`).setLabel('Equipe').setEmoji('👥').setStyle(ButtonStyle.Primary));
  }
  return [new ActionRowBuilder().addComponents(buttons)];
}

/**
 * Cria botões para votação/decisão de vencedor em um confronto
 * @param {Object} match - Confronto
 * @param {string} creatorId - ID do criador do simulado
 * @param {string} player1Name - Nome de exibição do jogador 1
 * @param {string} player2Name - Nome de exibição do jogador 2
 * @returns {Array} Array de ActionRow
 */
function matchButtons(match, creatorId, player1Name = null, player2Name = null) {
  const p1Name = player1Name || 'Jogador 1';
  const p2Name = player2Name || 'Jogador 2';
  
  const voteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`match:vote:${match.id}:0`)
      .setLabel(p1Name.slice(0, 30))
      .setEmoji('🔵')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(match.status !== 'aberto'),
    new ButtonBuilder()
      .setCustomId(`match:vote:${match.id}:1`)
      .setLabel(p2Name.slice(0, 30))
      .setEmoji('🔴')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(match.status !== 'aberto')
  );

  const forceRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`match:force:${match.id}`)
      .setPlaceholder('🏆 Quem venceu?')
      .addOptions(
        {
          label: p1Name,
          value: '0',
          emoji: '🟦'
        },
        {
          label: p2Name,
          value: '1',
          emoji: '🟥'
        }
      )
      .setDisabled(match.status !== 'aberto' && match.status !== 'divergente')
  );

  return [voteRow, new ActionRowBuilder().addComponents(forceRow)];
}

module.exports = { lobbyButtons, matchButtons };
