const fs = require('node:fs/promises');
const path = require('node:path');

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', '..', 'data');
const files = {
  simulados: path.join(dataDir, 'simulados.json'),
  jogadores: path.join(dataDir, 'jogadores.json'),
  config: path.join(dataDir, 'config.json')
};

async function ensureDataFiles() {
  await fs.mkdir(dataDir, { recursive: true });
  for (const [key, file] of Object.entries(files)) {
    try { await fs.access(file); } catch { await write(key, key === 'config' ? { nextSimuladoNumber: 1, nextMatchNumber: 1 } : []); }
  }
}

async function read(key) {
  await ensureDataFiles();
  return JSON.parse(await fs.readFile(files[key], 'utf8'));
}

async function write(key, value) {
  await fs.mkdir(dataDir, { recursive: true });
  const temp = `${files[key]}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temp, files[key]);
}

async function update(key, updater) {
  const value = await read(key);
  const next = await updater(value);
  await write(key, next);
  return next;
}

async function nextId(type) {
  const config = await read('config');
  const field = type === 'simulado' ? 'nextSimuladoNumber' : 'nextMatchNumber';
  const number = config[field] || 1;
  config[field] = number + 1;
  await write('config', config);
  return type === 'simulado' ? `sim_${String(number).padStart(4, '0')}` : `match_${String(number).padStart(3, '0')}`;
}

module.exports = { ensureDataFiles, read, write, update, nextId };
