const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const simuladoManager = require('../systems/simuladoManager');
const matchManager = require('../systems/matchManager');
const teamManager = require('../systems/teamManager');
const { maps, emotes, modes, mdOptions } = require('../config/content');
const { lobbyButtons } = require('../utils/buttons');
const { simuladoEmbed } = require('../utils/embeds');
const store = require('../systems/jsonManager');

async function reply(interaction, content) { if (interaction.replied || interaction.deferred) return interaction.followUp({ content, ephemeral: true }); return interaction.reply({ content, ephemeral: true }); }

async function execute(interaction) {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'simulado') {
      const roleId = process.env.SIMULADO_ADMIN_ROLE_ID;
      if (!interaction.memberPermissions?.has('Administrator') && roleId && !interaction.member.roles.cache.has(roleId)) return reply(interaction, 'Você não tem permissão para criar simulados.');
      
      await interaction.deferReply({ ephemeral: true });

      const nome = interaction.options.getString('nome');
      const vagas = interaction.options.getInteger('vagas');
      const modo = interaction.options.getString('modo');
      const mapasStr = interaction.options.getString('mapas').split(',').map(m => m.trim().toLowerCase());
      const emotesStr = interaction.options.getString('emotes').split(',').map(e => e.trim().toLowerCase());
      const md = interaction.options.getString('md');
      const descricao = interaction.options.getString('descricao') || '';

      // Validar mapas
      const mapasValidos = mapasStr.map(mapa => maps.find(m => m.id === mapa || m.nome.toLowerCase() === mapa)).filter(m => m);
      if (mapasValidos.length !== mapasStr.length) return interaction.editReply(`❌ Mapa inválido. Mapas disponíveis: ${maps.map(m => m.id).join(', ')}`);

      // Validar emotes
      const emotesValidos = emotesStr.map(emote => emotes.find(e => e.id === emote || e.nome.toLowerCase() === emote)).filter(e => e);
      if (emotesValidos.length !== emotesStr.length) return interaction.editReply(`❌ Emote inválido. Emotes disponíveis: ${emotes.map(e => e.id).join(', ')}`);

      // Criar simulado direto
      const draft = { 
        id: `${interaction.user.id}_${Date.now()}`, 
        name: nome, 
        slots: vagas, 
        description: descricao, 
        creator: { id: interaction.user.id, nome: interaction.user.username }, 
        mode: modo, 
        maps: mapasValidos, 
        emotes: emotesValidos, 
        md: md 
      };

      const simulado = await simuladoManager.createSimulado(draft, interaction.channel);
      return interaction.editReply(`✅ Simulado **${simulado.id}** criado com sucesso!`);
    }

    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    const [area, action, id, customValue] = interaction.customId.split(':');
    const value = interaction.isStringSelectMenu() ? interaction.values[0] : customValue;
    
    if (area === 'sim') {
      const simulado = await simuladoManager.get(id); if (!simulado) return reply(interaction, 'Simulado não encontrado.');
      if (action === 'join') { await simuladoManager.addPlayer(simulado, interaction.user); await simuladoManager.refresh(simulado, interaction.client); const team = simulado.equipes.find((item) => item.lider === interaction.user.id); return reply(interaction, team ? `Você entrou na ${team.nome} como líder.` : 'Você entrou no simulado.'); }
      if (action === 'leave') { await simuladoManager.removePlayer(simulado, interaction.user.id); await simuladoManager.refresh(simulado, interaction.client); return reply(interaction, 'Você saiu do simulado.'); }
      if (action === 'start') { if (interaction.user.id !== simulado.criador.id) return reply(interaction, 'Somente o criador pode iniciar.'); simulado._starter = interaction.user.id; simulado._guildId = interaction.guildId; await simuladoManager.start(simulado); await matchManager.createRound(simulado, interaction.client); await simuladoManager.refresh(simulado, interaction.client); return reply(interaction, 'Simulado iniciado.'); }
      if (action === 'team') { 
        await interaction.deferReply({ ephemeral: true });
        const { EmbedBuilder } = require('discord.js');
        const teams = teamManager.teamSelect(simulado);
        if (!teams.length) return interaction.editReply({ content: 'Não há equipes disponíveis no momento.' });
        const embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle('Selecione uma Equipe')
          .setDescription(`Escolha uma equipe para ${simulado.nome}`)
          .addFields(...teams.map(t => ({ name: t.label, value: t.description, inline: false })));
        return interaction.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`team:choose:${id}`).setPlaceholder('Clique para escolher').addOptions(teams))] }); 
      }
    }
    
    if (area === 'match') {
      await interaction.deferReply({ ephemeral: true });
      const match = (await store.read('simulados')).flatMap((item) => item.confrontos).find((item) => item.id === id); if (!match) return reply(interaction, 'Confronto não encontrado.');
      const simulado = await simuladoManager.get(match.simuladoId); match.creatorId = simulado.criador.id;
      if (action === 'vote') { 
        await matchManager.vote(match, interaction.user.id, Number(value)); 
        simulado.confrontos = simulado.confrontos.map((candidate) => candidate.id === id ? match : candidate); 
        await store.update('simulados', (items) => items.map((item) => item.id === simulado.id ? simulado : item)); 
        
        // Atualizar a mensagem do confronto
        const channel = await interaction.client.channels.fetch(match.canalId);
        const message = await channel.messages.fetch(match.messageId);
        const { matchEmbed } = require('../utils/embeds');
        await message.edit({ embeds: [matchEmbed(match, simulado)], components: require('../utils/buttons').matchButtons(match, simulado.criador.id) });
        
        if (match.status === 'finalizado') {
          await reply(interaction, '✅ Voto registrado!');
          await matchManager.deleteMatchChannel(match, interaction.client);
          await matchManager.advance(simulado, interaction.client);
          return;
        }
        return reply(interaction, match.status === 'divergente' ? `⚠️ Votos divergentes. ${simulado.criador.nome} deve decidir.` : '✅ Voto registrado!'); 
      }
      if (action === 'force') { 
        if (interaction.user.id !== simulado.criador.id) return reply(interaction, 'Somente o criador pode definir o vencedor.'); 
        match.vencedor = Number(value); 
        match.status = 'finalizado'; 
        simulado.confrontos = simulado.confrontos.map((candidate) => candidate.id === id ? match : candidate); 
        await store.update('simulados', (items) => items.map((item) => item.id === simulado.id ? simulado : item)); 
        
        // Atualizar a mensagem do confronto
        const channel = await interaction.client.channels.fetch(match.canalId);
        const message = await channel.messages.fetch(match.messageId);
        const { matchEmbed } = require('../utils/embeds');
        await message.edit({ embeds: [matchEmbed(match, simulado)], components: require('../utils/buttons').matchButtons(match, simulado.criador.id) });
        
        await reply(interaction, '✅ Vencedor definido!');
        await matchManager.deleteMatchChannel(match, interaction.client);
        await matchManager.advance(simulado, interaction.client); 
        return;
      }
    }
    
    if (area === 'team' && action === 'choose') {
      await interaction.deferReply({ ephemeral: true });
      const simulado = await simuladoManager.get(id);
      const team = await teamManager.requestJoin(simulado, value, interaction.user);
      await simuladoManager.refresh(simulado, interaction.client);
      if (team.lider === interaction.user.id && team.membros.length === 1) {
        const confirmationEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('Equipe escolhida')
          .setDescription(`Você entrou na ${team.nome} como líder.`);
        return interaction.editReply({ embeds: [confirmationEmbed] });
      }
      const leader = await interaction.client.users.fetch(team.lider);
      
      const notifEmbed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`${interaction.user.username} quer entrar`)
        .setDescription(`Clique para aceitar ou recusar`)
        .addFields(
          { name: 'Equipe', value: team.nome, inline: true },
          { name: 'Simulado', value: simulado.nome, inline: true }
        )
        .setThumbnail(interaction.user.displayAvatarURL());
      
      await leader.send({ 
        embeds: [notifEmbed], 
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`team:decision:${id}|${team.id}|${interaction.user.id}|1`).setLabel('Aceitar').setStyle(ButtonStyle.Success), 
          new ButtonBuilder().setCustomId(`team:decision:${id}|${team.id}|${interaction.user.id}|0`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
        )] 
      }).catch(() => null);
      
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('Pedido Enviado')
        .setDescription(`Sua solicitação foi enviada para ${team.nome}`);
      
      return interaction.editReply({ embeds: [confirmEmbed] });
    }
    
    if (area === 'team' && action === 'decision') {
      await interaction.deferReply({ ephemeral: true });
      const [simuladoId, teamId, userId, accepted] = id.split('|');
      const simulado = await simuladoManager.get(simuladoId);
      await teamManager.decide(simulado, teamId, userId, accepted === '1', interaction.user.id);
      await simuladoManager.refresh(simulado, interaction.client);
      
      const { EmbedBuilder } = require('discord.js');
      const resultEmbed = new EmbedBuilder()
        .setColor(accepted === '1' ? 0x2ecc71 : 0xe74c3c)
        .setTitle(accepted === '1' ? 'Jogador Aceito' : 'Pedido Recusado')
        .setDescription(`${userId} foi ${accepted === '1' ? 'aceito' : 'recusado'}`);
      
      return interaction.editReply({ embeds: [resultEmbed] });
    }
  } catch (error) { return reply(interaction, error.message); }
}

module.exports = { execute };
