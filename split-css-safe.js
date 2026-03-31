const fs = require('fs');
const content = fs.readFileSync('c:/Users/kirag/Documents/CODEX/app/globals.css.bak', 'utf-8');

// Find the boundary where Landing styles start.
// Looking at the original file, landing styles clearly start around:
// /* --- Landing Layered Snapshot --- */
const splitMarker = '/* --- Landing Layered Snapshot --- */';
const parts = content.split(splitMarker);

if (parts.length >= 2) {
  const mainUI = parts[0];
  const landingUI = splitMarker + parts.slice(1).join(splitMarker);

  fs.writeFileSync('c:/Users/kirag/Documents/CODEX/app/styles/main-ui.css', mainUI, 'utf-8');
  fs.writeFileSync('c:/Users/kirag/Documents/CODEX/app/styles/landing.css', landingUI, 'utf-8');
  console.log('Successfully split CSS into main-ui.css and landing.css by string matching.');
} else {
  console.log('Split marker not found!');
}
