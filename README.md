# Craicathon 2026 - Irish Voice Chat

A small full-stack app for speaking Irish into your browser, transcribing it with OpenAI, showing the transcript in chat, generating a reply in Irish, and speaking that reply back with ABAIR text-to-speech by default.

## Prerequisites

- Node.js 18+
- npm
- `OPENAI_API_KEY` in a repo-root `.env`

## Environment

Create `.env` in the project root:

```bash
OPENAI_API_KEY=your_key_here
PORT=3001
OPENAI_CHAT_MODEL=gpt-5-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe
TTS_PROVIDER=abair
ABAIR_VOICE=ga_UL_anb_piper

# Optional: switch back to OpenAI speech if you want
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=coral
```

You can also copy from `.env.example`.

## Development

Install dependencies once from the repo root:

```bash
npm install
```

Run backend and frontend together:

```bash
npm run dev
```

Open:

```bash
http://localhost:5173
```

## Local Deployment

Build the frontend and backend:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

Open:

```bash
http://localhost:3001
```

The backend serves the built frontend automatically when `frontend/dist` exists.

## Notes

- The browser app uses the microphone through `MediaRecorder`, so mic permission is required.
- Keep recordings short for the best local experience.
- The spoken reply is synthetic and should be disclosed as such to end users.
- Irish quality should be treated as something to validate with real usage and sample audio.
- Change `ABAIR_VOICE` in `.env` to try other ABAIR voices without changing code.
