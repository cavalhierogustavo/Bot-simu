require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { command } = require('./src/commands/simulado');

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) throw new Error('Configure DISCORD_TOKEN e CLIENT_ID.');
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const route = process.env.GUILD_ID ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID) : Routes.applicationCommands(process.env.CLIENT_ID);
rest.put(route, { body: [command.toJSON()] }).then(() => console.log('Comando /simulado publicado.')).catch(console.error);
