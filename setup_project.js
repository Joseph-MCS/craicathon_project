const fs = require('fs');
const path = require('path');

const dirs = [
  'frontend',
  'frontend/src',
  'frontend/src/components',
  'backend',
  'backend/src'
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Move files
const moves = [
  { src: 'server.ts', dest: 'backend/src/server.ts' },
  { src: 'ConversationInterface.tsx', dest: 'frontend/src/components/ConversationInterface.tsx' }
];

moves.forEach(move => {
  if (fs.existsSync(move.src)) {
    fs.renameSync(move.src, move.dest);
    console.log(`Moved ${move.src} to ${move.dest}`);
  }
});

console.log('Project structure created successfully!');
console.log('Now run:');
console.log('1. cd backend && npm init -y && npm install express cors axios typescript ts-node @types/express @types/cors');
console.log('2. cd ../frontend && npm create vite@latest . -- --template react-ts && npm install axios');
console.log('3. Copy ConversationInterface.tsx into your App.tsx');
