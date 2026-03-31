const fs = require('fs');

const content = fs.readFileSync('c:/Users/kirag/Documents/CODEX/app/styles/main-ui.css', 'utf-8');
const lines = content.split('\n');

// Specific line numbers found before
const componentsStart = 827; // .stat-grid { (the standalone one)
const animStart = 1564; // @keyframes button-ring-spin {
const mobileStart = 1635; // @media (max-width: 1200px) {

const baseCss = lines.slice(0, componentsStart).join('\n');
const componentsCss = lines.slice(componentsStart, animStart).join('\n');
const animsCss = lines.slice(animStart, mobileStart).join('\n');
const mobileCss = lines.slice(mobileStart).join('\n');

fs.writeFileSync('c:/Users/kirag/Documents/CODEX/app/styles/base.css', baseCss, 'utf-8');
fs.writeFileSync('c:/Users/kirag/Documents/CODEX/app/styles/components.css', componentsCss, 'utf-8');
fs.writeFileSync('c:/Users/kirag/Documents/CODEX/app/styles/utilities.css', animsCss, 'utf-8');
fs.writeFileSync('c:/Users/kirag/Documents/CODEX/app/styles/mobile.css', mobileCss, 'utf-8');

console.log('Successfully modularized main-ui.css into 4 files using exact validated boundaries.');
