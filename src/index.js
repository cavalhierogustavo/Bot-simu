require('dotenv').config();
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const { command } = require('./commands/simulado');
const { execute } = require('./events/interactionCreate');
const { onReady } = require('./events/ready');
const store = require('./systems/jsonManager');

if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN não configurado.');
if (!process.env.CLIENT_ID) throw new Error('CLIENT_ID não configurado.');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.commands = new Collection([[command.name, command]]);
client.once('ready', async () => {
	try {
		const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
		const route = process.env.GUILD_ID
			? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
			: Routes.applicationCommands(process.env.CLIENT_ID);
		await rest.put(route, { body: [command.toJSON()] });
		console.log(`Comando /${command.name} publicado${process.env.GUILD_ID ? ' no servidor configurado' : ' globalmente'}.`);
		await onReady(client);
	} catch (error) {
		console.error('Falha ao publicar comandos:', error);
	}
});
client.on('interactionCreate', (interaction) => execute(interaction).catch((error) => console.error('Interaction error:', error)));
store.ensureDataFiles().then(() => client.login(process.env.DISCORD_TOKEN)).catch(console.error);
