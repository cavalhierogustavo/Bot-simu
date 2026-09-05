const { ActionRowBuilder, UserSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const simuladoManager = require('../systems/simuladoManager');
const matchManager = require('../systems/matchManager');
const teamManager = require('../systems/teamManager');
const { lobbyButtons } = require('../utils/buttons');
const { simuladoEmbed } = require('../utils/embeds');
const { getPlayerDisplayName, getPlayerDisplayNames } = require('../utils/helpers');
const store = require('../systems/jsonManager');

async function reply(interaction, content) { 
  if (interaction.replied || interaction.deferred) return interaction.followUp({ content, ephemeral: true }); 
  return interaction.reply({ content, ephemeral: true }); 
}

/**
 * Atualiza a mensagem do confronto no canal específico
 */
async function updateMatchMessage(match, simulado, client) {
  try {
    if (!match.canalId || !match.messageId) return;
    
    const channel = await client.channels.fetch(match.canalId);
    const message = await channel.messages.fetch(match.messageId).catch(() => null);
    if (!message) return;
    
    const guild = await client.guilds.fetch(simulado._guildId);
    const p1DisplayName = await getPlayerDisplayNames(
      Array.isArray(match.participante1) ? match.participante1 : [match.participante1], 
      guild
    ).then(names => names[0]);
    const p2DisplayName = await getPlayerDisplayNames(
      Array.isArray(match.participante2) ? match.participante2 : [match.participante2], 
      guild
    ).then(names => names[0]);
    
    const { matchEmbed } = require('../utils/embeds');
    const { matchButtons } = require('../utils/buttons');
    
    await message.edit({ 
      embeds: [matchEmbed(match, simulado, p1DisplayName, p2DisplayName)], 
      components: matchButtons(match, simulado.criador.id, p1DisplayName, p2DisplayName)
    });
  } catch (error) {
    console.error('Erro ao atualizar mensagem do confronto:', error);
  }
}

async function kickListPayload(simulado, client, page = 0) {
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(simulado.participantes.length / pageSize));
  const currentPage = Math.min(Math.max(Number(page) || 0, 0), pageCount - 1);
  const pageParticipants = simulado.participantes.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const buttons = await Promise.all(pageParticipants.map(async (userId) => {
    const user = await client.users.fetch(userId).catch(() => null);
    return new ButtonBuilder()
      .setCustomId(`sim:kick:${simulado.id}:${userId}`)
      .setLabel(`🗑️ ${user?.username || userId}`.slice(0, 80))
      .setStyle(ButtonStyle.Danger);
  }));
  const rows = [];
  for (let index = 0; index < buttons.length; index += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(index, index + 5)));
  if (pageCount > 1) rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`sim:kicklist:${simulado.id}:${currentPage - 1}`).setLabel('◀️ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
    new ButtonBuilder().setCustomId(`sim:kicklist:${simulado.id}:${currentPage + 1}`).setLabel('Próxima ▶️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === pageCount - 1)
  ));
  return { 
    content: simulado.participantes.length ? `**👥 Participantes inscritos:** (página ${currentPage + 1}/${pageCount})\n${pageParticipants.map((userId, index) => `${String(currentPage * pageSize + index + 1).padStart(2, '0')} <@${userId}>`).join('\n')}` : 'Não há participantes inscritos.', 
    components: rows 
  };
}

async function execute(interaction) {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'simulado') {
      const roleId = process.env.SIMULADO_ADMIN_ROLE_ID;
      if (!interaction.memberPermissions?.has('Administrator') && roleId && !interaction.member.roles.cache.has(roleId)) return reply(interaction, 'Você não tem permissão para criar simulados.');
      
      await interaction.deferReply({ ephemeral: true });

      const nome = interaction.options.getString('nome');
      const vagas = interaction.options.getInteger('vagas');
      const modo = interaction.options.getString('modo');
      const draft = { 
        name: nome, 
        slots: vagas, 
        creator: { id: interaction.user.id, nome: interaction.user.username }, 
        mode: modo
      };

      const simulado = await simuladoManager.createSimulado(draft, interaction.channel);
      return interaction.editReply(`✅ Simulado **${simulado.id}** criado com sucesso!`);
    }

    if (!interaction.isButton() && !interaction.isUserSelectMenu() && !interaction.isStringSelectMenu()) return;
    const [area, action, id, customValue] = interaction.customId.split(':');
    const value = (interaction.isUserSelectMenu() || interaction.isStringSelectMenu()) ? interaction.values[0] : customValue;
    
    if (area === 'sim') {
      const simulado = await simuladoManager.get(id); 
      if (!simulado) return reply(interaction, 'Simulado não encontrado.');
      
      if (action === 'join') { 
        await simuladoManager.addPlayer(simulado, interaction.user); 
        await simuladoManager.refresh(simulado, interaction.client); 
        return reply(interaction, '✅ Você entrou no simulado.'); 
      }
      
      if (action === 'leave') { 
        await simuladoManager.removePlayer(simulado, interaction.user.id); 
        await simuladoManager.refresh(simulado, interaction.client); 
        return reply(interaction, '❌ Você saiu do simulado.'); 
      }
      
      if (action === 'kicklist') {
        if (interaction.user.id !== simulado.criador.id) return reply(interaction, 'Somente o criador pode expulsar participantes.');
        await interaction.deferReply({ ephemeral: true });
        return interaction.editReply(await kickListPayload(simulado, interaction.client, customValue));
      }
      
      if (action === 'kick') {
        if (interaction.user.id !== simulado.criador.id) return reply(interaction, 'Somente o criador pode expulsar participantes.');
        await simuladoManager.removePlayer(simulado, customValue);
        await simuladoManager.refresh(simulado, interaction.client);
        return interaction.update(await kickListPayload(simulado, interaction.client));
      }
      
      if (action === 'start') { 
        if (interaction.user.id !== simulado.criador.id) return reply(interaction, 'Somente o criador pode iniciar.');
        simulado._starter = interaction.user.id; 
        simulado._guildId = interaction.guildId; 
        await simuladoManager.start(simulado); 
        await matchManager.createRound(simulado, interaction.client); 
        await simuladoManager.refresh(simulado, interaction.client); 
        return reply(interaction, '🚀 Simulado iniciado!'); 
      }
      
      if (action === 'team') { 
        await interaction.deferReply({ ephemeral: true });
        return interaction.editReply({ 
          content: '👥 Escolha o jogador que deseja convidar:', 
          components: [new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
              .setCustomId(`team:invite:${id}`)
              .setPlaceholder('Selecionar jogador')
              .setMinValues(1)
              .setMaxValues(1)
          )] 
        });
      }
    }
    
    if (area === 'match') {
      await interaction.deferReply({ ephemeral: true });
      const match = (await store.read('simulados')).flatMap((item) => item.confrontos).find((item) => item.id === id); 
      if (!match) return reply(interaction, 'Confronto não encontrado.');
      
      const simulado = await simuladoManager.get(match.simuladoId); 
      if (!simulado) return reply(interaction, 'Simulado não encontrado.');
      
      match.creatorId = simulado.criador.id;
      
      if (action === 'vote') { 
        await matchManager.vote(match, interaction.user.id, Number(value)); 
        simulado.confrontos = simulado.confrontos.map((candidate) => candidate.id === id ? match : candidate); 
        await store.update('simulados', (items) => items.map((item) => item.id === simulado.id ? simulado : item)); 
        
        // Atualizar a mensagem do confronto
        await updateMatchMessage(match, simulado, interaction.client);
        
        if (match.status === 'finalizado') {
          await reply(interaction, '✅ Voto registrado e confronto finalizado!');
          await matchManager.deleteMatchChannel(match, interaction.client);
          await matchManager.advance(simulado, interaction.client);
          return;
        }
        
        return reply(interaction, match.status === 'divergente' ? `⚠️ Votos divergentes. ${simulado.criador.nome} deve decidir.` : '✅ Voto registrado!'); 
      }
      
      if (action === 'force') { 
        if (interaction.user.id !== simulado.criador.id) return reply(interaction, 'Somente o criador pode definir o vencedor.');
        
        // Validar que o valor é 0 ou 1
        const winnerChoice = Number(value);
        if (isNaN(winnerChoice) || (winnerChoice !== 0 && winnerChoice !== 1)) {
          return reply(interaction, 'Opção inválida.');
        }
        
        match.vencedor = winnerChoice;
        match.status = 'finalizado'; 
        simulado.confrontos = simulado.confrontos.map((candidate) => candidate.id === id ? match : candidate); 
        await store.update('simulados', (items) => items.map((item) => item.id === simulado.id ? simulado : item)); 
        
        // Atualizar a mensagem do confronto
        await updateMatchMessage(match, simulado, interaction.client);
        
        await reply(interaction, '✅ Vencedor definido!');
        await matchManager.deleteMatchChannel(match, interaction.client);
        await matchManager.advance(simulado, interaction.client); 
        return;
      }
    }
    
    if (area === 'team' && action === 'invite') {
      await interaction.deferReply({ ephemeral: true });
      const simulado = await simuladoManager.get(id);
      await teamManager.createInvite(simulado, interaction.user.id, value);
      const target = await interaction.client.users.fetch(value);
      
      const notifEmbed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('👥 Convite para formar equipe')
        .setDescription(`${interaction.user} quer formar uma equipe com você no simulado **${simulado.nome}**.`)
        .addFields(
          { name: 'Convidado por', value: interaction.user.username, inline: true },
          { name: 'Modo', value: simulado.modo, inline: true }
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();
      
      await target.send({ 
        embeds: [notifEmbed], 
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`team:decision:${id}|${interaction.user.id}|${value}|1`).setLabel('✅ Aceitar').setStyle(ButtonStyle.Success), 
          new ButtonBuilder().setCustomId(`team:decision:${id}|${interaction.user.id}|${value}|0`).setLabel('❌ Recusar').setStyle(ButtonStyle.Danger)
        )] 
      }).catch(() => { throw new Error('Não foi possível enviar uma DM para este jogador.'); });
      
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Pedido Enviado')
        .setDescription(`O convite foi enviado por DM para ${target.username}.`)
        .setTimestamp();
      
      return interaction.editReply({ embeds: [confirmEmbed] });
    }
    
    if (area === 'team' && action === 'decision') {
      await interaction.deferReply({ ephemeral: true });
      const [simuladoId, inviterId, userId, accepted] = id.split('|');
      const simulado = await simuladoManager.get(simuladoId);
      const team = await teamManager.decide(simulado, inviterId, userId, accepted === '1', interaction.user.id);
      await simuladoManager.refresh(simulado, interaction.client);
      
      const resultEmbed = new EmbedBuilder()
        .setColor(accepted === '1' ? 0x2ecc71 : 0xe74c3c)
        .setTitle(accepted === '1' ? '✅ Jogador Aceito' : '❌ Pedido Recusado')
        .setDescription(accepted === '1' ? `Você entrou na ${team.nome} com <@${inviterId}>.` : 'Você recusou o convite.')
        .setTimestamp();

      const inviter = await interaction.client.users.fetch(inviterId).catch(() => null);
      if (inviter) await inviter.send(accepted === '1' ? `✅ ${interaction.user.username} aceitou seu convite para formar a ${team.nome}.` : `❌ ${interaction.user.username} recusou seu convite.`).catch(() => null);
      
      return interaction.editReply({ embeds: [resultEmbed] });
    }
  } catch (error) { 
    console.error('Erro em interação:', error);
    return reply(interaction, `❌ Erro: ${error.message}`); 
  }
}

module.exports = { execute };
