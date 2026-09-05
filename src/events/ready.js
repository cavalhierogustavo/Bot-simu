const store = require('../systems/jsonManager');
async function onReady(client) {
  await store.ensureDataFiles();
  const simulados = await store.read('simulados');
  console.log(`Bot conectado como ${client.user.tag}. ${simulados.filter((item) => item.status !== 'finalizado').length} simulados ativos carregados.`);
}
module.exports = { onReady };
