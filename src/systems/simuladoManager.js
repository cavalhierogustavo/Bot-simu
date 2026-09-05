const store = require('./jsonManager');
const { modes } = require('../config/content');
const { simuladoEmbed } = require('../utils/embeds');
const { lobbyButtons } = require('../utils/buttons');
const { shuffle } = require('../utils/helpers');

async function createSimulado(draft, channel) {
  const id = await store.nextId('simulado');
  const teamCount = draft.mode === '1v1' ? 0 : Math.ceil(draft.slots / modes[draft.mode]);
  const simulado = { 
    id, 
    nome: draft.name, 
    criador: draft.creator, 
    vagas: draft.slots, 
    modo: draft.mode, 
    status: 'aberto', 
    participantes: [], 
    equipes: Array.from({ length: teamCount }, (_, index) => ({ 
      id: `team_${index + 1}`, 
      nome: `Equipe ${index + 1}`, 
      lider: null, 
      membros: [], 
      pedidos: [] 
    })), 
    rodadaAtual: 0, 
    confrontos: [], 
    vencedor: null, 
    canalId: channel.id, 
    mensagemId: null, 
    criadoEm: new Date().toISOString() 
  };
  
  await store.update('simulados', (items) => [...items, simulado]);
  const message = await channel.send({ embeds: [simuladoEmbed(simulado)], components: lobbyButtons(simulado) });
  simulado.mensagemId = message.id;
  await store.update('simulados', (items) => items.map((item) => item.id === id ? simulado : item));
  return simulado;
}

async function get(id) { 
  return (await store.read('simulados')).find((item) => item.id === id); 
}

async function save(simulado) { 
  await store.update('simulados', (items) => items.map((item) => item.id === simulado.id ? simulado : item)); 
}

async function refresh(simulado, client) { 
  const channel = await client.channels.fetch(simulado.canalId); 
  const message = await channel.messages.fetch(simulado.mensagemId); 
  await message.edit({ embeds: [simuladoEmbed(simulado)], components: lobbyButtons(simulado) }); 
}

async function addPlayer(simulado, user) { 
  if (simulado.participantes.includes(user.id)) throw new Error('Você já está participando deste simulado.'); 
  if (simulado.participantes.length >= simulado.vagas) throw new Error('Este simulado já está lotado.'); 
  simulado.participantes.push(user.id); 
  await save(simulado); 
  await store.update('jogadores', (players) => players.some((player) => player.userId === user.id) ? players.map((player) => player.userId === user.id ? { ...player, nome: user.username } : player) : [...players, { userId: user.id, nome: user.username, simuladosParticipados: [simulado.id], vitorias: 0, derrotas: 0 }]); 
  return simulado; 
}

async function removePlayer(simulado, userId) {
  if (!simulado.participantes.includes(userId)) throw new Error('Você não está neste simulado.');
  simulado.participantes = simulado.participantes.filter((id) => id !== userId);
  simulado.equipes.forEach((team) => {
    team.pedidos = team.pedidos.filter((id) => id !== userId);
    team.membros = team.membros.filter((id) => id !== userId);
    if (team.lider === userId) team.lider = team.membros[0] || null;
  });
  await save(simulado);
  return simulado;
}

async function start(simulado) {
  if (simulado.criador.id !== simulado._starter || simulado.participantes.length < simulado.vagas) throw new Error('Somente o criador pode iniciar e todas as vagas precisam estar preenchidas.');
  if (simulado.modo !== '1v1') {
    const capacity = Number(simulado.modo[0]);
    const activeTeams = simulado.equipes.filter((team) => team.membros.length);
    if (activeTeams.length < 2 || activeTeams.some((team) => team.membros.length > capacity)) throw new Error('Forme pelo menos duas equipes válidas antes de iniciar.');
    if (simulado.participantes.some((userId) => !simulado.equipes.some((team) => team.membros.includes(userId)))) throw new Error('Todos os participantes precisam estar em uma equipe antes de iniciar.');
    if (simulado.modo === '2v2' && activeTeams.some((team) => team.membros.length !== capacity)) throw new Error('No modo 2v2, todas as equipes precisam ter 2 jogadores.');
  }
  simulado.status = 'em_andamento'; 
  simulado.rodadaAtual = 1; 
  await save(simulado); 
  return simulado;
}

function shuffledParticipants(simulado) { 
  return simulado.modo === '1v1' ? shuffle(simulado.participantes) : shuffle(simulado.equipes.filter((team) => team.membros.length)); 
}

module.exports = { createSimulado, get, save, refresh, addPlayer, removePlayer, start, shuffledParticipants };
