const simuladoManager = require('./simuladoManager');

async function requestJoin(simulado, teamId, user) {
  const team = simulado.equipes.find((item) => item.id === teamId);
  if (!team || team.membros.length >= Number(simulado.modo[0])) throw new Error('Equipe inexistente ou cheia.');
  if (!simulado.participantes.includes(user.id)) throw new Error('Entre no simulado antes de solicitar uma equipe.');
  if (team.membros.includes(user.id)) throw new Error('Você já está nesta equipe.');
  if (simulado.equipes.some((item) => item.membros.includes(user.id))) throw new Error('Você já está em uma equipe.');
  if (!team.membros.length) {
    team.lider = user.id;
    team.membros.push(user.id);
    await simuladoManager.save(simulado);
    return team;
  }
  if (!team.pedidos.includes(user.id)) team.pedidos.push(user.id);
  await simuladoManager.save(simulado);
  return team;
}
async function decide(simulado, teamId, userId, accepted, leaderId) {
  const team = simulado.equipes.find((item) => item.id === teamId);
  if (!team || team.lider !== leaderId) throw new Error('Somente o líder pode decidir este pedido.');
  if (!team.pedidos.includes(userId)) throw new Error('Pedido não encontrado.');
  team.pedidos = team.pedidos.filter((id) => id !== userId);
  if (accepted && team.membros.length < Number(simulado.modo[0])) team.membros.push(userId);
  await simuladoManager.save(simulado);
  return team;
}
function teamSelect(simulado) { return simulado.equipes.filter((team) => team.membros.length < Number(simulado.modo[0])).map((team) => ({ label: team.nome, value: team.id, description: `${team.membros.length}/${simulado.modo[0]} jogadores` })); }
module.exports = { requestJoin, decide, teamSelect };
