# Craicathon Project (Irish Learning + Side Quests)

Interactive full-stack app for learning Irish through conversation, voice, and game-style side quests.

https://frontend-chi-blush-rcn4b04i3b.vercel.app/

Current major experiences:

- Core Learning: Irish chat with voice input/output (OpenAI-backed)
- Slang and Culture Cards: pronunciation, scenarios, seasonal cards, leaderboard, saved/learned collections
- Pint Dash: Irish-themed bar quest with table navigation, hint-assisted language matching, and serving actions

## 1) Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- APIs: OpenAI (chat, transcription, TTS, translation/pronunciation helpers)
- Styling: custom CSS (Irish-themed visual design)
- Monorepo: npm workspaces (`frontend`, `backend`)

## 2) Project Structure

```text
.
├─ backend/
│  ├─ src/server.ts
│  └─ package.json
├─ frontend/
│  ├─ src/
│  │  ├─ App.tsx
│  │  └─ components/
│  │     ├─ ConversationInterface.tsx
│  │     ├─ IrishSideQuest.tsx
│  │     └─ PintDashQuest.tsx
│  ├─ public/
│  │  └─ irish-girl.gif   (sprite used in Pint Dash)
│  └─ package.json
├─ .env.example
└─ package.json
```

## 3) Prerequisites

- Node.js 18+
- npm 9+

## 4) Environment Setup

Create a repo-root `.env` file (same level as the root `package.json`):

```env
OPENAI_API_KEY=your_openai_key

PORT=3001
OPENAI_CHAT_MODEL=gpt-5-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=coral

# Optional future integration
OLLAMA_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

Tip: copy from `.env.example` and fill in values.

## 5) Install and Run Locally

From repo root:

```bash
npm install
npm run dev
```

Local URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`

## 6) Build and Run Production Locally

From repo root:

```bash
npm run build
npm start
```

Production URL:

- `http://localhost:3001`

When `frontend/dist` exists, backend serves the built frontend.

## 7) Features by Module

### Core Learning

- Text and voice Irish conversation flow
- Voice transcription pipeline
- Irish TTS response playback
- Translation and pronunciation helper endpoints

### Slang and Culture Cards (`IrishSideQuest`)

- Card of the Day + card collections
- Save / Learn / Unlearn card states
- Pagination in collections (2 cards per page)
- Regional variations (Dublin/Cork/Galway)
- Scenario challenges with feedback
- Historical context notes
- Seasonal cards (Brigid / Patrick / Samhain)
- Voice recording and playback (browser-side)
- Leaderboard tab

### Pint Dash (`PintDashQuest`)

- Irish pub scene with clickable tables
- Barmaid sprite movement to selected table
- Customer mixed English/Irish prompts
- Hint button reveals beginner translation support
- Match correct Irish reply, then serve correct drink
- Score and accuracy feedback loop

## 8) API Endpoints

Main routes in `backend/src/server.ts`:

- `GET /api/health`
- `POST /api/chat`
- `POST /api/voice-chat`
- `POST /api/translate`
- `POST /api/pronunciation`
- `GET /api/sidequest/cards`
- `GET /api/sidequest/daily`
- `GET /api/sidequest/seasonal`
- `POST /api/sidequest/leaderboard`
- `GET /api/sidequest/leaderboard`

## 9) Vercel Deployment (Frontend)

Deploy from `frontend/`:

```bash
cd frontend
npx vercel deploy --prod
```

Notes:

- Vercel auto-detects Vite settings
- If TypeScript errors exist, deployment fails until fixed
- If using backend APIs, ensure your frontend points to a reachable backend URL in production

## 10) Assets and Sprite Setup

Pint Dash expects the barmaid sprite at:

- `frontend/public/irish-girl.gif`

Fallback search order in code:

1. `/irish-girl.gif`
2. `/irish-girl.png`
3. `/irish-girl.webp`

## 11) Troubleshooting

### Sprite not showing

- Confirm file exists at `frontend/public/irish-girl.gif`
- Restart dev server
- Hard refresh browser

### Build fails on Vercel

- Run locally first: `cd frontend && npm run build`
- Fix TypeScript errors before redeploy

### Mic/voice not working

- Check browser microphone permission
- Ensure HTTPS in deployed environment for media APIs

## 12) Replication Checklist

1. Clone repository
2. Create `.env` in repo root
3. Run `npm install` from root
4. Add sprite to `frontend/public/irish-girl.gif`
5. Run `npm run dev`
6. Visit `http://localhost:5173`
7. Test Core Learning, Culture Cards, and Pint Dash
