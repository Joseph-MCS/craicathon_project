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
const TTS_PROVIDER = (process.env.TTS_PROVIDER || 'abair').trim().toLowerCase() === 'openai' ? 'openai' : 'abair';
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'coral';
const ABAIR_API_BASE = process.env.ABAIR_API_BASE || 'https://api.abair.ie/v3';
const ABAIR_LANGUAGE_CODE = process.env.ABAIR_LANGUAGE_CODE || 'ga-IE';
const ABAIR_VOICE = process.env.ABAIR_VOICE || 'ga_UL_anb_piper';
const ABAIR_AUDIO_ENCODING = process.env.ABAIR_AUDIO_ENCODING || 'MP3';
const ABAIR_SPEAKING_RATE = Number(process.env.ABAIR_SPEAKING_RATE || 1);
const ABAIR_PITCH = Number(process.env.ABAIR_PITCH || 1);
const ABAIR_VOLUME_GAIN_DB = Number(process.env.ABAIR_VOLUME_GAIN_DB || 1);
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const VOICE_DISCLOSURE = 'The spoken reply uses a synthetic voice.';
const IRISH_TUTOR_INSTRUCTIONS = [
  'You are a warm Irish-language conversation partner for learners.',
  'Always reply entirely in Irish.',
  'Keep your replies concise, natural, and encouraging.',
  'If the learner makes a mistake, gently model the correct Irish in your reply without switching to English.',
  'If the learner uses English, ask them in Irish to continue in Irish.',
  'Prefer everyday Irish with correct fada marks.'
].join(' ');
const GLOSS_DIALECTS = ['Ulster', 'Connacht', 'Munster'] as const;
const MAX_WORD_GLOSS_CACHE_ENTRIES = 250;
const WORD_GLOSS_INSTRUCTIONS = [
  'You help an Irish learner understand one hovered Irish word inside a short Irish sentence.',
  'Return strict JSON only with keys: translation, note, dialects.',
  'translation should be concise natural English, at most 6 words.',
  'note should be a short explanation of nuance or grammar, at most 18 words.',
  'dialects must be an array of exactly 3 objects in this order: Ulster, Connacht, Munster.',
  'Each dialect object must contain dialect and pronunciation.',
  'pronunciation must be a learner-friendly respelling in English letters, not IPA.',
  'Use the sentence context to choose the most likely meaning.'
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

type WordGlossRequest = {
  context?: string;
  word?: string;
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

type ParsedWordGlossPayload = {
  dialects?: Array<{
    dialect?: string;
    pronunciation?: string;
  }>;
  note?: string;
  translation?: string;
};

type AbairErrorPayload = {
  error?: string;
};

type AbairSynthesisPayload = AbairErrorPayload & {
  audioContent?: string;
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

type WordGlossResponse = {
  dialects: Array<{
    dialect: string;
    pronunciation: string;
  }>;
  note: string;
  translation: string;
  word: string;
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
const wordGlossCache = new Map<string, WordGlossResponse>();

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

  return 'Something went wrong while processing the request.';
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

function extractAbairError(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const error = (payload as AbairErrorPayload).error;

    if (typeof error === 'string' && error.trim().length > 0) {
      return error;
    }
  }

  return 'ABAIR request failed.';
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

function sanitizeLookupWord(word: unknown): string {
  if (typeof word !== 'string') {
    return '';
  }

  return word
    .trim()
    .replace(/[^\p{L}\p{M}'’\-]/gu, '')
    .slice(0, 48);
}

function sanitizeContextSnippet(context: unknown): string {
  if (typeof context !== 'string') {
    return '';
  }

  return context
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 180);
}

function extractJsonObject(text: string): string {
  const firstBraceIndex = text.indexOf('{');
  const lastBraceIndex = text.lastIndexOf('}');

  if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex < firstBraceIndex) {
    throw new Error('OpenAI returned an invalid word glossary response.');
  }

  return text.slice(firstBraceIndex, lastBraceIndex + 1);
}

function normalizeDialectName(dialect: string): string | null {
  const normalizedDialect = dialect.trim().toLowerCase();

  if (normalizedDialect.includes('ul')) {
    return 'Ulster';
  }

  if (normalizedDialect.includes('con')) {
    return 'Connacht';
  }

  if (normalizedDialect.includes('mun')) {
    return 'Munster';
  }

  return null;
}

function trimWordGlossCache() {
  while (wordGlossCache.size > MAX_WORD_GLOSS_CACHE_ENTRIES) {
    const oldestKey = wordGlossCache.keys().next().value;

    if (!oldestKey) {
      return;
    }

    wordGlossCache.delete(oldestKey);
  }
}

function parseWordGlossResponse(rawText: string, word: string): WordGlossResponse {
  const parsedPayload = JSON.parse(extractJsonObject(rawText)) as ParsedWordGlossPayload;
  const translation = typeof parsedPayload.translation === 'string' ? parsedPayload.translation.trim() : '';

  if (!translation) {
    throw new Error('OpenAI returned a glossary card without a translation.');
  }

  const note = typeof parsedPayload.note === 'string' ? parsedPayload.note.trim() : '';
  const dialectMap = new Map<string, string>();

  for (const dialectEntry of parsedPayload.dialects ?? []) {
    const normalizedDialect = normalizeDialectName(dialectEntry?.dialect ?? '');
    const pronunciation = typeof dialectEntry?.pronunciation === 'string' ? dialectEntry.pronunciation.trim() : '';

    if (normalizedDialect && pronunciation) {
      dialectMap.set(normalizedDialect, pronunciation);
    }
  }

  const firstPronunciation = dialectMap.values().next().value ?? '';

  return {
    dialects: GLOSS_DIALECTS.map((dialect) => ({
      dialect,
      pronunciation: dialectMap.get(dialect) || firstPronunciation || 'Fuaimniú le teacht'
    })),
    note,
    translation,
    word
  };
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

async function generateWordGloss(word: string, context: string): Promise<WordGlossResponse> {
  ensureConfigured();

  const cacheKey = `${word.toLocaleLowerCase('ga-IE')}::${context.toLocaleLowerCase('ga-IE')}`;
  const cachedGloss = wordGlossCache.get(cacheKey);

  if (cachedGloss) {
    return cachedGloss;
  }

  const response = await fetch(`${OPENAI_API_BASE}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      instructions: WORD_GLOSS_INSTRUCTIONS,
      max_output_tokens: 220,
      model: CHAT_MODEL,
      reasoning: {
        effort: 'minimal'
      },
      input: [
        {
          content: [
            {
              text: [`Word: ${word}`, `Context sentence: ${context || '(not provided)'}`].join('\n'),
              type: 'input_text'
            }
          ],
          role: 'user'
        }
      ]
    })
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(extractOpenAIError(payload));
  }

  const rawText = readResponseText(payload);

  if (!rawText) {
    throw new Error('OpenAI returned an empty glossary response.');
  }

  const wordGloss = parseWordGlossResponse(rawText, word);

  wordGlossCache.set(cacheKey, wordGloss);
  trimWordGlossCache();

  return wordGloss;
}

async function synthesizeOpenAIReply(text: string): Promise<{ audioBase64: string; audioMimeType: string }> {
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

async function synthesizeAbairReply(text: string): Promise<{ audioBase64: string; audioMimeType: string }> {
  const response = await fetch(`${ABAIR_API_BASE}/synthesis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      synthinput: {
        text
      },
      voiceparams: {
        languageCode: ABAIR_LANGUAGE_CODE,
        name: ABAIR_VOICE,
        ssmlGender: 'UNSPECIFIED'
      },
      audioconfig: {
        audioEncoding: ABAIR_AUDIO_ENCODING,
        speakingRate: ABAIR_SPEAKING_RATE,
        pitch: ABAIR_PITCH,
        volumeGainDb: ABAIR_VOLUME_GAIN_DB
      },
      outputType: 'JSON'
    })
  });

  const payload = (await response.json().catch(() => null)) as AbairSynthesisPayload | null;

  if (!response.ok) {
    throw new Error(extractAbairError(payload));
  }

  const audioBase64 = payload?.audioContent?.trim();

  if (!audioBase64) {
    throw new Error('ABAIR returned an empty audio response.');
  }

  return {
    audioBase64,
    audioMimeType: 'audio/mpeg'
  };
}

async function synthesizeIrishReply(text: string): Promise<{ audioBase64: string; audioMimeType: string }> {
  if (TTS_PROVIDER === 'openai') {
    return synthesizeOpenAIReply(text);
  }

  return synthesizeAbairReply(text);
}

app.get('/api/health', (_req, res) => {
  res.json({
    configured: Boolean(OPENAI_API_KEY),
    models: {
      chat: CHAT_MODEL,
      transcription: TRANSCRIPTION_MODEL,
      tts: TTS_PROVIDER === 'openai' ? TTS_MODEL : 'abair',
      ttsProvider: TTS_PROVIDER,
      voice: TTS_PROVIDER === 'openai' ? TTS_VOICE : ABAIR_VOICE
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

app.post('/api/word-gloss', async (req, res) => {
  const { context, word } = req.body as WordGlossRequest;
  const lookupWord = sanitizeLookupWord(word);
  const safeContext = sanitizeContextSnippet(context);

  if (!lookupWord) {
    return res.status(400).json({ error: 'A word is required.' });
  }

  try {
    const gloss = await generateWordGloss(lookupWord, safeContext);
    return res.json(gloss);
  } catch (error) {
    console.error('Word gloss failed:', error);
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
