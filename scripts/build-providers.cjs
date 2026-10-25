const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'providers/framextv.js'), 'utf8');
const miner = fs.readFileSync(path.join(__dirname, 'miner-client.js'), 'utf8');
const entries = [
  ['framextv', 'super_barbarian', 'Super Barbarian'],
  ['framextv-miner', 'miner', 'Miner'],
  ['framextv-headhunter', 'headhunter', 'Headhunter'],
  ['framextv-valkyrie', 'valkyrie', 'Valkyrie'],
  ['framextv-hog-rider', 'hog_rider', 'Hog Rider'],
  ['framextv-lava-hound', 'lavahound', 'Lava Hound'],
  ['framextv-bowler', 'bowler', 'Bowler'],
  ['framextv-royal-champion', 'royal_champion', 'Royal Champion'],
  ['framextv-skeleton-king', 'skeleton_king', 'Skeleton King'],
  ['framextv-titan', 'titan', 'Titan'],
  ['framextv-giant', 'giant', 'Giant'],
  ['framextv-executioner', 'executioner', 'Executioner'],
  ['framextv-root-rider', 'root_rider', 'Root Rider'],
  ['framextv-archer-queen', 'archer_queen', 'Archer Queen']
];
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
if (manifest.scrapers.length !== entries.length) throw Error('Provider catalog differs from manifest');
for (const [id, api, label] of entries) {
  const entry = manifest.scrapers.find(s => s.id === id);
  if (!entry || entry.filename !== `providers/${id}.js`) throw Error('Unexpected provider path: ' + id);
  let code = template.replace(/var PROVIDER = "[^"]+";/, `var PROVIDER = "${api}";`)
    .replace(/var LABEL = "[^"]+";/, `var LABEL = "${label}";`);
  if (api === 'miner') {
    if (!code.includes('// BEGIN PROVIDER LOOKUP')) throw Error('Missing strategy marker');
    code = code.replace(/  \/\/ BEGIN PROVIDER LOOKUP[\s\S]*?  \/\/ END PROVIDER LOOKUP/, () => miner.trimEnd());
  }
  const file = path.join(root, entry.filename);
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(file, 'utf8') !== code) throw Error('Run npm run build: ' + entry.filename);
  } else fs.writeFileSync(file, code);
}
console.log(`All ${entries.length} standalone providers are consistent.`);
