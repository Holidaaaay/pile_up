const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve(process.argv[2] ?? 'build/wechatgame-release');
const gamePath = path.join(output, 'game.json');
const settingsPath = path.join(output, 'src/settings.json');
const game = JSON.parse(fs.readFileSync(gamePath, 'utf8'));
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

if (settings.engine.platform !== 'wechatgame' || settings.engine.debug) {
    throw new Error('Expected a non-debug Cocos WeChat Game build.');
}

const source = path.join(output, 'assets/resources');
const destination = path.join(output, 'subpackages/resources');
const registered = game.subpackages.some(({ name }) => name === 'resources');
if (!registered) {
    // Cocos keeps its built-in resources bundle in the main package. The adapter uses
    // settings.assets.subpackages to choose its loader and config path for that bundle.
    if (fs.existsSync(source) && !fs.existsSync(destination)) fs.renameSync(source, destination);
    const entry = path.join(destination, 'game.js');
    if (!fs.existsSync(entry)) fs.renameSync(path.join(destination, 'index.js'), entry);
    fs.accessSync(path.join(destination, 'config.json'));
    if (!settings.assets.subpackages.includes('resources')) settings.assets.subpackages.push('resources');
    game.subpackages.push({ name: 'resources', root: 'subpackages/resources/' });
    fs.writeFileSync(settingsPath, JSON.stringify(settings));
}

const openDataContext = 'openDataContext';
fs.cpSync(path.join(__dirname, '../build-templates/wechatgame', openDataContext),
    path.join(output, openDataContext), { recursive: true });
game.openDataContext = openDataContext;
fs.writeFileSync(gamePath, JSON.stringify(game, null, 4));

function sizeOf(dir, excluded = []) {
    return fs.readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
        if (excluded.includes(entry.name)) return total;
        const entryPath = path.join(dir, entry.name);
        return total + (entry.isDirectory() ? sizeOf(entryPath) : fs.statSync(entryPath).size);
    }, 0);
}

const mainSize = sizeOf(output, ['subpackages']);
const packageSize = sizeOf(output);
if (mainSize > 4 * 1024 ** 2 || packageSize > 30 * 1024 ** 2) {
    throw new Error(`Package exceeds size limits (main: ${mainSize}, total: ${packageSize} bytes).`);
}
console.log(`WeChat release: ${mainSize} bytes main, ${packageSize} bytes total.`);
