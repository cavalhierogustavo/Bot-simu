# Bot de Simulados para Discord

Bot em Node.js, discord.js 14 e persistência JSON para torneios 1v1, 2v2 e 3v3.

## Instalação

1. Instale Node.js 20 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env` e preencha `DISCORD_TOKEN`, `CLIENT_ID` e opcionalmente `GUILD_ID` e `SIMULADO_ADMIN_ROLE_ID`.
4. Execute `npm run deploy` para registrar `/simulado`.
5. Execute `npm start`.

Os dados são salvos em `data/` com escrita temporária e renomeação para reduzir risco de corrupção.

O fluxo atual cobre criação com seleção múltipla, entrada, equipes, pedidos, sorteio, canais privados e votação. Para produção, configure permissões do bot para gerenciar canais e mensagens.

## Deploy no Railway

1. Crie um serviço a partir deste repositório e mantenha o comando de inicialização como `npm start`.
2. Cadastre no Railway as variáveis `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `SIMULADO_ADMIN_ROLE_ID` e `DATA_DIR`.
3. Adicione um Volume persistente e use o caminho de montagem do Volume em `DATA_DIR` (por exemplo, `/data`).
4. Execute `npm run deploy` uma vez, localmente ou em um serviço separado, sempre que alterar o comando `/simulado`.

O Railway não exige novos IDs. Use os mesmos IDs do Discord. O token que já esteve no arquivo `.env` deve ser regenerado no Discord Developer Portal antes do deploy, caso tenha sido exposto.
