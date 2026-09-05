const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function lobbyButtons(simulado) {
  const buttons = [
    new ButtonBuilder().setCustomId(`sim:join:${simulado.id}`).setLabel('Entrar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sim:leave:${simulado.id}`).setLabel('Sair').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`sim:kicklist:${simulado.id}`).setLabel('Expulsar participante').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`sim:start:${simulado.id}`).setLabel('Iniciar Torneio').setStyle(ButtonStyle.Danger)
  ];
  if (simulado.modo !== '1v1') buttons.push(new ButtonBuilder().setCustomId(`sim:team:${simulado.id}`).setLabel('Criar/Entrar em equipe').setStyle(ButtonStyle.Primary));
  return [new ActionRowBuilder().addComponents(buttons)];
}

function matchButtons(match, creatorId) {
  const rows = [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`match:vote:${match.id}:0`).setLabel(match.participantNames[0].slice(0, 20)).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`match:vote:${match.id}:1`).setLabel(match.participantNames[1].slice(0, 20)).setStyle(ButtonStyle.Success)
  )];
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`match:force:${match.id}:0`).setLabel('Decidir 1').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`match:force:${match.id}:1`).setLabel('Decidir 2').setStyle(ButtonStyle.Danger)
  ));
  return rows;
}
module.exports = { lobbyButtons, matchButtons };
