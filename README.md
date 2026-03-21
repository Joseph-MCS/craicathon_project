# Craicathon 2026 - Irish Language Learning App

## Project Status: Configuration Complete

All necessary configuration files have been created. You just need to install dependencies and start the servers.

## Prerequisites

- Node.js (v18+)
- npm

## Quick Start

### 1. Install Backend Dependencies
```bash
cd backend
npm install
```

### 2. Start Backend Server
```bash
npm run dev
# Server runs on http://localhost:3001
```

### 3. Install Frontend Dependencies
Open a new terminal:
```bash
cd frontend
npm install
```

### 4. Start Frontend Application
```bash
npm run dev
# App runs on http://localhost:5173
```

## Troubleshooting

If you see errors like "Cannot find module", ensure you have run `npm install` in both directories.

## Features Implemented

*   **Speech-to-Text**: Uses Web Speech API (`ga-IE` locale).
*   **Text-to-Speech**: Mock integration for ABAIR API.
*   **Grammar Check**: Mock integration for Gaelspell.
*   **Conversation**: Simple request/response loop.

## Next Steps

1. Get API keys for ABAIR and Gaelspell.
2. Connect OpenAI/Anthropic API for real intelligence.
3. Improve UI with CSS/Styled Components.
