require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { command } = require('./commands/simulado');
const { execute } = require('./events/interactionCreate');
const { onReady } = require('./events/ready');
const store = require('./systems/jsonManager');

if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN não configurado.');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.commands = new Collection([[command.name, command]]);
client.once('ready', () => onReady(client).catch(console.error));
client.on('interactionCreate', (interaction) => execute(interaction).catch((error) => console.error('Interaction error:', error)));
store.ensureDataFiles().then(() => client.login(process.env.DISCORD_TOKEN)).catch(console.error);
