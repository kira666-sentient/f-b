const fs = require('fs');
const lines = fs.readFileSync('c:/Users/kirag/Documents/CODEX/app/globals.css.bak', 'utf-8').split('\n');
fs.writeFileSync('c:/Users/kirag/Documents/CODEX/app/styles/base.css', lines.slice(0, 827).join('\n'), 'utf-8');
fs.writeFileSync('c:/Users/kirag/Documents/CODEX/app/styles/components.css', lines.slice(827, 1564).join('\n'), 'utf-8');
fs.writeFileSync('c:/Users/kirag/Documents/CODEX/app/styles/animations.css', lines.slice(1564, 1635).join('\n'), 'utf-8');
fs.writeFileSync('c:/Users/kirag/Documents/CODEX/app/styles/mobile.css', lines.slice(1635, 2280).join('\n'), 'utf-8');
fs.writeFileSync('c:/Users/kirag/Documents/CODEX/app/styles/landing.css', lines.slice(2280).join('\n'), 'utf-8');
console.log('Split complete!');
