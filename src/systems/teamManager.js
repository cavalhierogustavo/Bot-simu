const simuladoManager = require('./simuladoManager');

function teamOf(simulado, userId) { return simulado.equipes.find((team) => team.membros.includes(userId)); }

async function createInvite(simulado, inviterId, targetId) {
  if (simulado.modo === '1v1') throw new Error('Equipes não existem no modo 1v1.');
  if (inviterId === targetId) throw new Error('Você não pode convidar a si mesmo.');
  if (teamOf(simulado, targetId)) throw new Error('Este jogador já está em uma equipe.');
  const inviterTeam = teamOf(simulado, inviterId);
  if (inviterTeam && inviterTeam.membros.length >= Number(simulado.modo[0])) throw new Error('Sua equipe já está cheia.');
  return inviterTeam;
}

async function decide(simulado, inviterId, targetId, accepted, recipientId) {
  if (recipientId !== targetId) throw new Error('Somente o jogador convidado pode responder este convite.');
  if (!accepted) return null;
  if (teamOf(simulado, targetId)) throw new Error('Um dos jogadores já está em uma equipe.');
  const inviterTeam = teamOf(simulado, inviterId);
  if (inviterTeam) {
    if (inviterTeam.membros.length >= Number(simulado.modo[0])) throw new Error('A equipe do convite já está cheia.');
    inviterTeam.membros.push(targetId);
    await simuladoManager.save(simulado);
    return inviterTeam;
  }
  const team = simulado.equipes.find((item) => item.membros.length === 0);
  if (!team) throw new Error('Não há equipes disponíveis neste simulado.');
  team.lider = inviterId;
  team.membros = [inviterId, targetId];
  await simuladoManager.save(simulado);
  return team;
}

async function addToExistingTeam(simulado, inviterId, targetId) {
  const team = teamOf(simulado, inviterId);
  if (!team || team.membros.length >= Number(simulado.modo[0])) throw new Error('Sua equipe não pode receber mais jogadores.');
  if (teamOf(simulado, targetId)) throw new Error('Este jogador já está em uma equipe.');
  team.membros.push(targetId);
  await simuladoManager.save(simulado);
  return team;
}

module.exports = { createInvite, decide, addToExistingTeam, teamOf };
