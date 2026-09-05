const { EmbedBuilder } = require('discord.js');
const { mention, truncate } = require('./helpers');

function slotText(simulado) {
  if (simulado.modo === '1v1') {
    return simulado.participantes.map((id, index) => `${index + 1}. ${mention(id)}`).join('\n') || 'Nenhum participante';
  }
  const capacity = Number(simulado.modo[0]);
  return simulado.equipes.map((team) => `${team.nome} (${team.membros.length}/${capacity})\n${team.membros.map((id) => mention(id)).join(' | ') || 'Vazio'}`).join('\n\n') || 'Nenhuma equipe';
}

function simuladoEmbed(simulado) {
  const embed = new EmbedBuilder()
    .setColor(simulado.status === 'aberto' ? 0x3498db : 0xe67e22)
    .setTitle(`${simulado.nome}`)
    .addFields(
      { name: 'Modo', value: simulado.modo, inline: true },
      { name: 'Vagas', value: `${simulado.participantes.length}/${simulado.vagas}`, inline: true },
      { name: 'MD', value: simulado.md, inline: true },
      { name: 'Mapas', value: simulado.mapas.map((map) => map.nome).join(', '), inline: false },
      { name: 'Emotes', value: simulado.emotes.map((emote) => emote.nome).join(' + '), inline: false },
      { name: 'Participantes', value: truncate(slotText(simulado), 1024), inline: false }
    );
  if (simulado.descricao) embed.addFields({ name: 'Descrição', value: truncate(simulado.descricao), inline: false });
  embed.setFooter({ text: `${simulado.criador.nome} | ${simulado.status}` });
  return embed;
}

function matchEmbed(match, simulado) {
  const votosCount = Object.values(match.votos).reduce((acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }), {});
  
  let description = `${match.participantNames[0]} vs ${match.participantNames[1]}\n\n`;
  description += `Mapa: ${match.mapa.nome}\n`;
  description += `Emotes: ${match.emotes.map(e => e.nome).join(' + ')}\n`;
  description += `MD: ${match.md}\n\n`;
  
  if (match.status === 'aberto') {
    description += `Votos:\n`;
    description += `${match.participantNames[0]}: ${votosCount[0] || 0}\n`;
    description += `${match.participantNames[1]}: ${votosCount[1] || 0}`;
  } else if (match.status === 'finalizado') {
    const winner = match.vencedor === 0 ? match.participantNames[0] : match.participantNames[1];
    description += `Vencedor: ${winner}`;
  } else {
    description += `Votos divergentes - Aguardando decisão do criador`;
  }

  return new EmbedBuilder()
    .setColor(match.status === 'aberto' ? 0x3498db : match.status === 'finalizado' ? 0x2ecc71 : 0xe74c3c)
    .setTitle(`Confronto ${match.id}`)
    .setDescription(description)
    .setFooter({ text: match.status });
}

module.exports = { simuladoEmbed, slotText, matchEmbed };
