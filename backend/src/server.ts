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

type SlangCard = {
  id: string;
  phrase: string;
  pronunciation: string;
  meaning: string;
  whenToUse: string;
  example: string;
  cultureNote: string;
  wordBreakdown: Array<{
    irish: string;
    soundLike: string;
    tip: string;
  }>;
};

const sideQuestCards: SlangCard[] = [
  {
    id: 'grand',
    phrase: 'Tá sé grand',
    pronunciation: 'taw sheh grand',
    meaning: "It's fine / all good",
    whenToUse: 'When you want to say everything is okay.',
    example: 'Ná bí buartha, tá sé grand.',
    cultureNote: '"Grand" is one of the most common Irish-English expressions in daily life.',
    wordBreakdown: [
      { irish: 'Tá', soundLike: 'taw', tip: 'Long open a sound.' },
      { irish: 'sé', soundLike: 'sheh', tip: 'Soft sh sound at the start.' },
      { irish: 'grand', soundLike: 'grand', tip: 'Same as English here.' }
    ]
  },
  {
    id: 'whisht',
    phrase: 'Fan ciúin a chara',
    pronunciation: 'fahn kyoo-in uh khar-uh',
    meaning: 'Be quiet for a second',
    whenToUse: 'When asking someone to pause while listening to important news.',
    example: 'Fan ciúin a chara, tá an scéal ag tosú.',
    cultureNote: 'In Irish homes, short playful commands are often softened with "a chara".',
    wordBreakdown: [
      { irish: 'Fan', soundLike: 'fahn', tip: 'Short a like in "father".' },
      { irish: 'ciúin', soundLike: 'kyoo-in', tip: 'Two beats: kyoo + in.' },
      { irish: 'a', soundLike: 'uh', tip: 'Very light unstressed sound.' },
      { irish: 'chara', soundLike: 'khar-uh', tip: 'Breathy kh at the start.' }
    ]
  },
  {
    id: 'deadly',
    phrase: 'Sin marfach!',
    pronunciation: 'shin mar-fakh',
    meaning: 'That is brilliant!',
    whenToUse: 'When reacting to something exciting or impressive.',
    example: 'Fuair mé ticéid don cheolchoirm. Sin marfach!',
    cultureNote: 'Like "deadly" in Hiberno-English, some intense words are used positively.',
    wordBreakdown: [
      { irish: 'Sin', soundLike: 'shin', tip: 'Soft sh sound.' },
      { irish: 'marfach', soundLike: 'mar-fakh', tip: 'Final ch is throaty, not "ch" as in chair.' }
    ]
  },
  {
    id: 'craic',
    phrase: 'Cad é an craic?',
    pronunciation: 'kod eh un crack',
    meaning: "What's the story / how are things?",
    whenToUse: 'As a casual friendly greeting.',
    example: 'A Sheáin, cad é an craic inniu?',
    cultureNote: '"Craic" is central to social culture and means fun, atmosphere, and conversation.',
    wordBreakdown: [
      { irish: 'Cad', soundLike: 'kod', tip: 'Short o-like vowel.' },
      { irish: 'é', soundLike: 'eh', tip: 'Short and light.' },
      { irish: 'an', soundLike: 'un', tip: 'Neutral unstressed vowel.' },
      { irish: 'craic', soundLike: 'crack', tip: 'Rhymes with "back".' }
    ]
  },
  {
    id: 'go-on',
    phrase: 'Ar aghaidh leat!',
    pronunciation: 'er ah-hig lat',
    meaning: 'Go on, you can do it!',
    whenToUse: 'To encourage someone before an action.',
    example: 'Tá tú réidh don óráid. Ar aghaidh leat!',
    cultureNote: 'Encouraging phrases are common in Irish banter and sports culture.',
    wordBreakdown: [
      { irish: 'Ar', soundLike: 'er', tip: 'Short, quick opening.' },
      { irish: 'aghaidh', soundLike: 'ah-hig', tip: 'Middle gh is soft and breathy.' },
      { irish: 'leat', soundLike: 'lat', tip: 'Single beat, crisp t ending.' }
    ]
  },
  {
    id: 'surelook',
    phrase: 'Bhuel, sin é an saol',
    pronunciation: 'wel shin eh un sayl',
    meaning: "Sure look, that's life",
    whenToUse: 'When accepting small setbacks with humor.',
    example: 'Chaill mé an bus, ach bhuel, sin é an saol.',
    cultureNote: 'A resigned but warm attitude is a recognizable part of Irish conversational style.',
    wordBreakdown: [
      { irish: 'Bhuel', soundLike: 'wel', tip: 'Starts with a soft v/w blend.' },
      { irish: 'sin', soundLike: 'shin', tip: 'Soft sh sound.' },
      { irish: 'e', soundLike: 'eh', tip: 'Short and light.' },
      { irish: 'an', soundLike: 'un', tip: 'Very light unstressed vowel.' },
      { irish: 'saol', soundLike: 'sayl', tip: 'Single syllable, long ay sound.' }
    ]
  }
];

function getDailyCard(cards: SlangCard[]): SlangCard {
  const now = new Date();
  const daySeed = Number(`${now.getUTCFullYear()}${now.getUTCMonth() + 1}${now.getUTCDate()}`);
  const index = daySeed % cards.length;
  return cards[index];
}

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

app.get('/api/sidequest/cards', (_req, res) => {
  res.json({ cards: sideQuestCards });
});

app.get('/api/sidequest/daily', (_req, res) => {
  res.json({ card: getDailyCard(sideQuestCards) });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
