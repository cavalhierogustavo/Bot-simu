const { SlashCommandBuilder } = require('discord.js');
const { maps, emotes, modes, mdOptions } = require('../config/content');

const command = new SlashCommandBuilder()
  .setName('simulado')
  .setDescription('Cria um novo simulado ou torneio')
  .addStringOption(option => option.setName('nome').setDescription('Nome do simulado').setRequired(true).setMaxLength(100))
  .addIntegerOption(option => option.setName('vagas').setDescription('Número de vagas').setRequired(true).addChoices({ name: '2', value: 2 },{ name: '8', value: 8 }, { name: '16', value: 16 }, { name: '32', value: 32 }, { name: '64', value: 64 }))
  .addStringOption(option => option.setName('modo').setDescription('Modo de jogo').setRequired(true).addChoices(...Object.keys(modes).map(mode => ({ name: mode, value: mode }))))
  .addStringOption(option => option.setName('mapas').setDescription('Mapas (separados por vírgula)').setRequired(true))
  .addStringOption(option => option.setName('emotes').setDescription('Emotes (separados por vírgula)').setRequired(true))
  .addStringOption(option => option.setName('md').setDescription('Melhor de').setRequired(true).addChoices(...mdOptions.map(md => ({ name: md, value: md }))))
  .addStringOption(option => option.setName('descricao').setDescription('Descrição do simulado').setRequired(false).setMaxLength(1000));

module.exports = { command };
