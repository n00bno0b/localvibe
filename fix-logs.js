const fs = require('fs');
const file = 'localforge/packages/local-brain/src/browser/local-brain-widget.ts';
let code = fs.readFileSync(file, 'utf8');

// Simple escape function for innerHTML
code = code.replace(
    'return `<div style="color: ${color}; white-space: pre-wrap;">[${l.level}] ${l.message}</div>`;',
    'const escapedMessage = l.message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); return `<div style="color: ${color}; white-space: pre-wrap;">[${l.level}] ${escapedMessage}</div>`;'
);

fs.writeFileSync(file, code);
