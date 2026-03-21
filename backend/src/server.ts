import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import { existsSync } from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = Number(process.env.PORT || 3001);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_BASE = 'https://api.openai.com/v1';
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5-mini';
const TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-transcribe';
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'coral';
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const VOICE_DISCLOSURE = 'The spoken reply uses an AI-generated voice.';
const IRISH_TUTOR_INSTRUCTIONS = [
  'You are a warm Irish-language conversation partner for learners.',
  'Always reply entirely in Irish.',
  'Keep your replies concise, natural, and encouraging.',
  'If the learner makes a mistake, gently model the correct Irish in your reply without switching to English.',
  'If the learner uses English, ask them in Irish to continue in Irish.',
  'Prefer everyday Irish with correct fada marks.'
].join(' ');

type ClientMessage = {
  mode?: 'text' | 'voice';
  role: 'user' | 'assistant';
  text: string;
};

type TextChatRequest = {
  history?: ClientMessage[];
  message?: string;
};

type VoiceChatRequest = {
  audioBase64?: string;
  history?: ClientMessage[];
  mimeType?: string;
};

type OpenAIErrorPayload = {
  error?: {
    message?: string;
  };
};

type OpenAITranscriptionPayload = OpenAIErrorPayload & {
  text?: string;
};

type OpenAIResponsePayload = OpenAIErrorPayload & {
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
    role?: string;
    type?: string;
  }>;
  output_text?: string;
};

app.use(cors());
app.use(express.json({ limit: '20mb' }));

function sanitizeHistory(history: unknown): ClientMessage[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((item): item is ClientMessage => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }

      const role = (item as ClientMessage).role;
      const text = (item as ClientMessage).text;

      return (role === 'user' || role === 'assistant') && typeof text === 'string' && text.trim().length > 0;
    })
    .slice(-10)
    .map((item) => ({
      mode: item.mode === 'voice' ? 'voice' : 'text',
      role: item.role,
      text: item.text.trim()
    }));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong while talking to OpenAI.';
}

function extractOpenAIError(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const openAIError = (payload as OpenAIErrorPayload).error;

    if (openAIError && typeof openAIError.message === 'string' && openAIError.message.trim().length > 0) {
      return openAIError.message;
    }
  }

  return 'OpenAI request failed.';
}

function readResponseText(payload: OpenAIResponsePayload): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  const fragments =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((part) => part.text?.trim() ?? '')
      .filter((part) => part.length > 0) ?? [];

  return fragments.join('\n').trim();
}

function extensionFromMimeType(mimeType: string): string {
  const normalizedMimeType = mimeType.split(';')[0].trim().toLowerCase();

  if (normalizedMimeType === 'audio/mp4') {
    return 'mp4';
  }

  if (normalizedMimeType === 'audio/mpeg') {
    return 'mp3';
  }

  if (normalizedMimeType === 'audio/ogg') {
    return 'ogg';
  }

  if (normalizedMimeType === 'audio/wav') {
    return 'wav';
  }

  return 'webm';
}

function ensureConfigured() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing. Add it to the repo root .env file and restart the server.');
  }
}

async function transcribeIrishAudio(audioBase64: string, mimeType: string): Promise<string> {
  ensureConfigured();

  const audioBuffer = Buffer.from(audioBase64, 'base64');

  if (audioBuffer.length === 0) {
    throw new Error('No audio was received. Please try recording again.');
  }

  if (audioBuffer.length > MAX_AUDIO_BYTES) {
    throw new Error('That recording is too large. Keep clips short and try again.');
  }

  const formData = new FormData();
  const fileExtension = extensionFromMimeType(mimeType);

  formData.append(
    'file',
    new Blob([audioBuffer], { type: mimeType || 'audio/webm' }),
    `irish-clip.${fileExtension}`
  );
  formData.append('model', TRANSCRIPTION_MODEL);
  formData.append(
    'prompt',
    [
      'The speaker is speaking Irish (Gaeilge).',
      'Preserve Irish spelling and fada marks.',
      'Common words and phrases may include Dia duit, conas atá tú, go raibh maith agat, fáilte, slán, and craic.'
    ].join(' ')
  );
  formData.append('response_format', 'json');

  const response = await fetch(`${OPENAI_API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: formData
  });

  const payload = (await response.json()) as OpenAITranscriptionPayload;

  if (!response.ok) {
    throw new Error(extractOpenAIError(payload));
  }

  const transcript = payload.text?.trim();

  if (!transcript) {
    throw new Error('OpenAI returned an empty transcript. Try speaking a bit more clearly into the mic.');
  }

  return transcript;
}

async function generateIrishReply(message: string, history: ClientMessage[]): Promise<string> {
  ensureConfigured();

  const input = [
    ...history.map((item) => ({
      content: [
        {
          text: item.text,
          type: item.role === 'assistant' ? 'output_text' : 'input_text'
        }
      ],
      role: item.role
    })),
    {
      content: [
        {
          text: message,
          type: 'input_text'
        }
      ],
      role: 'user'
    }
  ];

  const response = await fetch(`${OPENAI_API_BASE}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      instructions: IRISH_TUTOR_INSTRUCTIONS,
      max_output_tokens: 220,
      model: CHAT_MODEL,
      reasoning: {
        effort: 'minimal'
      },
      input
    })
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(extractOpenAIError(payload));
  }

  const reply = readResponseText(payload);

  if (!reply) {
    throw new Error('OpenAI returned an empty reply.');
  }

  return reply;
}

async function synthesizeIrishReply(text: string): Promise<{ audioBase64: string; audioMimeType: string }> {
  ensureConfigured();

  const response = await fetch(`${OPENAI_API_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: text,
      instructions: 'Speak warmly, clearly, and at a measured pace for an Irish language learner. Pronounce Irish words as carefully as possible.',
      model: TTS_MODEL,
      response_format: 'mp3',
      voice: TTS_VOICE
    })
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as OpenAIErrorPayload | null;
    throw new Error(extractOpenAIError(errorPayload));
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  return {
    audioBase64: audioBuffer.toString('base64'),
    audioMimeType: response.headers.get('content-type') || 'audio/mpeg'
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    configured: Boolean(OPENAI_API_KEY),
    models: {
      chat: CHAT_MODEL,
      transcription: TRANSCRIPTION_MODEL,
      tts: TTS_MODEL,
      voice: TTS_VOICE
    },
    voiceDisclosure: VOICE_DISCLOSURE
  });
});

app.post('/api/chat', async (req, res) => {
  const { history, message } = req.body as TextChatRequest;
  const cleanedMessage = typeof message === 'string' ? message.trim() : '';

  if (!cleanedMessage) {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  try {
    const safeHistory = sanitizeHistory(history);
    const reply = await generateIrishReply(cleanedMessage, safeHistory);
    const speech = await synthesizeIrishReply(reply);

    return res.json({
      ...speech,
      reply,
      voiceDisclosure: VOICE_DISCLOSURE
    });
  } catch (error) {
    console.error('Chat pipeline failed:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
});

app.post('/api/voice-chat', async (req, res) => {
  const { audioBase64, history, mimeType } = req.body as VoiceChatRequest;

  if (typeof audioBase64 !== 'string' || audioBase64.trim().length === 0) {
    return res.status(400).json({ error: 'Audio data is required.' });
  }

  try {
    const safeHistory = sanitizeHistory(history);
    const transcript = await transcribeIrishAudio(audioBase64, mimeType || 'audio/webm');
    const reply = await generateIrishReply(transcript, safeHistory);
    const speech = await synthesizeIrishReply(reply);

    return res.json({
      ...speech,
      reply,
      transcript,
      voiceDisclosure: VOICE_DISCLOSURE
    });
  } catch (error) {
    console.error('Voice pipeline failed:', error);
    return res.status(500).json({ error: getErrorMessage(error) });
  }
});

const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');

if (existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }

    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('text/plain').send('Irish voice app API is running. Start the frontend dev server on http://localhost:5173 or build the frontend for single-server mode.');
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
