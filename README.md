# Craicathon 2026 - Setup Instructions

Because of environment limitations preventing directory creation, all files have been created in the root directory. 

## Automated Setup (Recommended)

Run the following command to automatically organize the project structure:

```bash
node setup_project.js
```

This will create `frontend` and `backend` directories and move the files into place.

## Manual Setup (If automated fails)

Please manually move the files to the following structure:

```
/craicathon_project
  /backend
    /src
      server.ts (Move server.ts here)
    package.json (Run npm init and install express cors axios)
    tsconfig.json
  /frontend
    /src
      /components
        ConversationInterface.tsx (Move ConversationInterface.tsx here)
      App.tsx
      main.tsx
    package.json (Run npm init and install react react-dom axios vite)
    tsconfig.json
```

## Running the Backend

1. Navigate to `backend` folder.
2. Run `npm install express cors axios typescript ts-node @types/express @types/cors @types/node`.
3. Run `npx ts-node src/server.ts`.

## Running the Frontend

1. Navigate to `frontend` folder.
2. Run `npm create vite@latest .` (Choose React + TypeScript).
3. Install dependencies: `npm install axios`.
4. Copy `ConversationInterface.tsx` to `src/components`.
5. Import and use `ConversationInterface` in `App.tsx`.
6. Run `npm run dev`.

## Features Implemented

*   **Speech-to-Text**: Uses Web Speech API (`ga-IE` locale).
*   **Text-to-Speech**: Mock integration for ABAIR API.
*   **Grammar Check**: Mock integration for Gaelspell.
*   **Conversation**: Simple request/response loop.

## Next Steps

1. Get API keys for ABAIR and Gaelspell.
2. Connect OpenAI/Anthropic API for real intelligence.
3. Improve UI with CSS/Styled Components.
