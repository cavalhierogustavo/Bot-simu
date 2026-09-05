function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function parseIds(value) {
  return Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function mention(id) { return `<@${id}>`; }
function truncate(value, length = 900) { return String(value || '').slice(0, length) || 'Não informado'; }

module.exports = { shuffle, parseIds, mention, truncate };
