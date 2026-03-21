import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import { existsSync } from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = Number(process.env.PORT || 3001);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';
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
  regions?: {
    dublin?: string;
    cork?: string;
    galway?: string;
  };
  scenario?: {
    situation: string;
    options: Array<{
      text: string;
      correct: boolean;
      feedback: string;
    }>;
  };
  historyNote?: string;
  isSeasonalCard?: boolean;
  seasonalType?: 'brigid' | 'patrick' | 'samhain' | null;
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
    ],
    regions: {
      dublin: 'Tá sé go deas (more formal alternative)',
      cork: 'Tá sé breá liom (I love it - used for emphasis)',
      galway: 'Tá sé ar dheis (traditional Connemara version)'
    },
    scenario: {
      situation: "A colleague offers you tea. How do you respond if it's perfect?",
      options: [
        { text: 'Tá sé grand, go raibh maith agat', correct: true, feedback: '✓ Perfect! You thanked them warmly.' },
        { text: 'Níl sé grand', correct: false, feedback: '✗ This means "It\'s not fine" - the opposite!' },
        { text: 'Grand amháin', correct: false, feedback: '✗ Close, but the phrase structure is off.' }
      ]
    },
    historyNote: 'Used in Irish since medieval times, "grand" evolved into Hiberno-English as the universal response during British colonial period.',
    isSeasonalCard: false,
    seasonalType: null
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
    ],
    regions: {
      dublin: 'Shh nóiméad (just "shh" with a word for moment)',
      cork: 'Stad anois (more direct: stop now)',
      galway: 'Fan go fóill (traditional: wait a moment)'
    },
    scenario: {
      situation: 'You\'re in a traditional Irish pub and the storyteller is about to speak. Your friend is talking loudly. What do you say?',
      options: [
        { text: 'Fan ciúin a chara!', correct: true, feedback: '✓ Brilliant! Everyone likes a respectful listener in a traditional setting.' },
        { text: 'Stad, a amadáin!', correct: false, feedback: '✗ Too harsh - you\'d offend your friend!' },
        { text: 'Tóg go bog é', correct: false, feedback: '✗ This means "take it easy" but doesn\'t ask for quiet.' }
      ]
    },
    historyNote: 'From Irish folklore tradition where silence was sacred during storytelling (seanchaí) in ancient céilis.',
    isSeasonalCard: false,
    seasonalType: null
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
    ],
    regions: {
      dublin: 'Go tobann (suddenly - used to emphasize surprise)',
      cork: 'Draíochta! (magical exclamation)',
      galway: 'Ar fheabhas! (excellent - most formal)'
    },
    scenario: {
      situation: 'Your friend just told you they got a job as an Irish language teacher. What\'s your reaction?',
      options: [
        { text: 'Sin marfach!', correct: true, feedback: '✓ Perfect enthusiasm! Your friend will feel your genuine joy.' },
        { text: 'Sin dúr!', correct: false, feedback: '✗ This means "stupid" - definitely not what you meant!' },
        { text: 'Sin go breá!', correct: false, feedback: '✗ This is more about love/preference, not fitting here.' }
      ]
    },
    historyNote: 'The use of deadly words positively dates to Irish youth slang culture of the 1980s-90s Dublin scene.',
    isSeasonalCard: false,
    seasonalType: null
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
    ],
    regions: {
      dublin: 'Cad atá ar siúl? (What\'s going on? - more common in north Dublin)',
      cork: 'Conas atá tú? (How are you? - traditional greeting)',
      galway: 'Cad é an ceol? (What\'s the music? - playful variation)'
    },
    scenario: {
      situation: 'You meet an old Irish friend on the street after months. How do you greet them warmly?',
      options: [
        { text: 'Cad é an craic, a chara?', correct: true, feedback: '✓ Genuine, warm, and authentically Irish!' },
        { text: 'Cad é an báisteach?', correct: false, feedback: '✗ That literally means "What\'s the rain?" - awkward!' },
        { text: 'Cad a tharla?', correct: false, feedback: '✗ This means "What happened?" - implies something went wrong.' }
      ]
    },
    historyNote: '"Craic" (from Old Irish "imcraid" meaning entertainment) was revived culturally in 1980s as symbol of Irish identity against anglicization.',
    isSeasonalCard: false,
    seasonalType: null
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
    ],
    regions: {
      dublin: 'Téigh ann! (Go there! - direct Dublin style)',
      cork: 'Ar agus ar! (Really hammer it home)',
      galway: 'Tobac leat! (Off you go! - Connemara traditional)'
    },
    scenario: {
      situation: 'Your nervous friend is about to give their first Irish speech at a céilí. How do you boost their confidence?',
      options: [
        { text: 'Ar aghaidh leat, a chara!', correct: true, feedback: '✓ Perfect encouragement for a traditional setting!' },
        { text: 'Shábháil tú é!', correct: false, feedback: '✗ This means "you saved it" - past tense, not encouraging!' },
        { text: 'Is fearr liom', correct: false, feedback: '✗ This means "I prefer" - totally off topic.' }
      ]
    },
    historyNote: 'Sports coaching in Irish schools has kept this phrase alive; used extensively at Gaelic Athletic Association (GAA) matches since 1884.',
    isSeasonalCard: false,
    seasonalType: null
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
    ],
    regions: {
      dublin: 'Bhuel, timpeall an tsolais (life\'s about the light - more philosophical)',
      cork: 'Ná bí i do bhrón (don\'t be sad - empathetic approach)',
      galway: 'An saol go fóill (life still goes on - accepting tone)'
    },
    scenario: {
      situation: 'A tourist lost their Irish language guidebook during a rainstorm in Galway. How do you comfort them philosophically?',
      options: [
        { text: 'Bhuel, sin é an saol, a chara!', correct: true, feedback: '✓ Authentic Irish wisdom - they\'ll remember this kindness!' },
        { text: 'Faraor go leor (sadly enough)', correct: false, feedback: '✗ Too negative - doesn\'t offer comfort.' },
        { text: 'Is breá liom an ghaoth (I love the wind)', correct: false, feedback: '✗ Irrelevant and confusing!' }
      ]
    },
    historyNote: 'This philosophical acceptance rooted in Irish Catholic poetry tradition; popularized in modern times by RTE Irish dramas since 1970s.',
    isSeasonalCard: false,
    seasonalType: null
  },
  // Seasonal Cards
  {
    id: 'brigid-card',
    phrase: 'Naomh Bhríde go raibh maith aici',
    pronunciation: 'nay-v vree-jeh guh rev muh ah-jee',
    meaning: 'Saint Brigid, thank you (blessing)',
    whenToUse: 'On St. Brigid\'s Day (February 1) or when blessing someone\'s home.',
    example: 'Ar Lá Fhéile Bhríde, a raibh maith aici as a beannacht.',
    cultureNote: 'St. Brigid (450-520 AD) is Ireland\'s patron saint of wells, poetry, and healing. Her feast day marks the beginning of spring in Celtic tradition.',
    wordBreakdown: [
      { irish: 'Naomh', soundLike: 'nay-v', tip: 'Silent m before b.' },
      { irish: 'Bhríde', soundLike: 'vree-jeh', tip: 'Feminine genitive triggers lenition.' },
      { irish: 'go', soundLike: 'guh', tip: 'Linking word for gratitude.' },
      { irish: 'raibh', soundLike: 'rev', tip: 'Past tense of "to be".' }
    ],
    regions: {
      dublin: 'Lá Fhéile Bhríde (modern urban form)',
      cork: 'Féile Bhríde an spréacharnach (the sparking festival)',
      galway: 'Imbolc i réim (Celtic name: Imbolc season)'
    },
    scenario: {
      situation: 'You\'re visiting a traditional Irish home on St. Brigid\'s Day. The host lights a candle asking for blessings. What do you say?',
      options: [
        { text: 'Naomh Bhríde go raibh maith aici!', correct: true, feedback: '✓ Respectful and culturally aware! The host smiles warmly.' },
        { text: 'Brigid is gheal (Brigid is bright)', correct: false, feedback: '✗ Close meaning but wrong prayer structure.' },
        { text: 'Tús an earraigh (start of spring)', correct: false, feedback: '✗ More poetic than prayerful - not quite right.' }
      ]
    },
    historyNote: 'St. Brigid\'s crosses are woven on her feast day; her sacred wells still draw pilgrims seeking healing. Imbolc (Feb 1) is the first day of spring in Celtic calendar.',
    isSeasonalCard: true,
    seasonalType: 'brigid'
  },
  {
    id: 'patrick-card',
    phrase: 'Lá Fhéile Phádraig sona duit!',
    pronunciation: 'law hay-luh fah-rig sun-uh gwit',
    meaning: 'Happy St. Patrick\'s Day! (literal: A lucky St. Patrick\'s Day feast day to you)',
    whenToUse: 'On March 17th to greet people celebrating Irish culture.',
    example: 'Lá Fhéile Phádraig sona duit! Subh scéal ar gréine, is éadach ar foluain.',
    cultureNote: 'St. Patrick (387-461 AD) brought Christianity to Ireland and is commemorated globally. In Ireland, it\'s a spiritual and cultural celebration.',
    wordBreakdown: [
      { irish: 'Lá', soundLike: 'law', tip: 'Day - long á sound.' },
      { irish: 'Fhéile', soundLike: 'hay-luh', tip: 'Feast (lenited form).' },
      { irish: 'Phádraig', soundLike: 'fah-rig', tip: 'Patrick (lenited patron form).' },
      { irish: 'sona', soundLike: 'sun-uh', tip: 'Lucky/happy.' }
    ],
    regions: {
      dublin: 'Nollaig na Foluain (Wandering Christmas - poetic alternative)',
      cork: 'Féile Phádraig i mbaile na sealadh (traditional village celebration)',
      galway: 'Féile an tSolais (Festival of Light - ancient name)'
    },
    scenario: {
      situation: 'You\'re at a céilí on St. Patrick\'s Day and meet locals. How do you greet them authentically?',
      options: [
        { text: 'Lá Fhéile Phádraig sona duit!', correct: true, feedback: '✓ Perfectly authentic! The locals are impressed!' },
        { text: 'Happy St. Patrick\'s Day!', correct: false, feedback: '✗ English works but you\'re in an Irish-speaking space!' },
        { text: 'Pádraig ó Éirinn!', correct: false, feedback: '✗ Close but grammatically off - "Patrick from Ireland" doesn\'t fit.' }
      ]
    },
    historyNote: 'St. Patrick\'s missionary work (432 AD onwards) converted Ireland to Christianity within a generation. Despite global commercialization, Irish families attend mass on this holy day.',
    isSeasonalCard: true,
    seasonalType: 'patrick'
  },
  {
    id: 'samhain-card',
    phrase: 'Beannacht Shamhna ort!',
    pronunciation: 'ban-ukh hau-nuh ort',
    meaning: 'Blessings of Samhain upon you! (Celtic New Year greeting)',
    whenToUse: 'On October 31st / November 1st during the Celtic New Year celebration.',
    example: 'Oíche Shamhna na spréacharnach - beannacht orm ar na mairbh.',
    cultureNote: 'Samhain (Nov 1) marks the Celtic New Year and the thinning of veil between worlds. Bonfires were lit to guide ancestor spirits.',
    wordBreakdown: [
      { irish: 'Beannacht', soundLike: 'ban-ukht', tip: 'Blessing - very Irish.' },
      { irish: 'Shamhna', soundLike: 'hau-nuh', tip: 'Of Samhain (lenited genitive).' },
      { irish: 'ort', soundLike: 'ort', tip: 'On you (preposition).' }
    ],
    regions: {
      dublin: 'Oíche Shamhna i nGaoth Dobhair (modern remembrance form)',
      cork: 'An Samhain thoir (eastern Samhain - ancient timing)',
      galway: 'Tine Shamhna na spréite (Samhain spirit fires)'
    },
    scenario: {
      situation: 'You\'re bonfire-sitting on Samhain night in Connemara with elderly Irish speakers. How do you respectfully greet them?',
      options: [
        { text: 'Beannacht Shamhna ort!', correct: true, feedback: '✓ Beautifully respectful! They recognize your spiritual awareness.' },
        { text: 'Oíche Shamhna sona!', correct: false, feedback: '✗ Close but "sona" is for luck - "beannacht" is more spiritually appropriate here.' },
        { text: 'Halloween go raibh maith agat', correct: false, feedback: '✗ English word in Irish context - less authentic!' }
      ]
    },
    historyNote: 'Samhain originates from pre-Christian Celtic calendar; Christianized as All Hallows\' Eve. Modern Halloween preserves ancient Celtic fire festival traditions.',
    isSeasonalCard: true,
    seasonalType: 'samhain'
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
    ollamaConfigured: Boolean(OLLAMA_API_KEY),
    models: {
      chat: CHAT_MODEL,
      transcription: TRANSCRIPTION_MODEL,
      tts: TTS_MODEL,
      voice: TTS_VOICE,
      ollama: OLLAMA_MODEL
    },
    ollamaBaseUrl: OLLAMA_BASE_URL,
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

app.get('/api/sidequest/seasonal', (_req, res) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const date = now.getDate();

  let seasonalType: 'brigid' | 'patrick' | 'samhain' | null = null;

  if ((month === 2 && date === 1) || month === 2) {
    seasonalType = 'brigid';
  } else if ((month === 3 && date === 17) || month === 3) {
    seasonalType = 'patrick';
  } else if ((month === 10 && date >= 31) || month === 11) {
    seasonalType = 'samhain';
  }

  const seasonal = seasonalType
    ? sideQuestCards.filter(c => c.seasonalType === seasonalType)
    : [];

  res.json({ seasonal, seasonalType });
});

app.post('/api/sidequest/leaderboard', (req, res) => {
  const { userId, cardsLearned, score } = req.body;

  if (!userId || typeof cardsLearned !== 'number' || typeof score !== 'number') {
    return res.status(400).json({ error: 'userId, cardsLearned, and score are required.' });
  }

  // For hackathon demo: store in memory (in production, use a database)
  const leaderboardKey = 'sidequest_leaderboard';
  const raw = localStorage.getItem(leaderboardKey) || '[]';

  try {
    let entries = JSON.parse(raw) as Array<{ userId: string; cardsLearned: number; score: number; timestamp: number }>;

    // Remove or update existing entry for this userId
    entries = entries.filter(e => e.userId !== userId);

    // Add new entry
    entries.push({ userId, cardsLearned, score, timestamp: Date.now() });

    // Sort by cardsLearned desc, then by score desc
    entries.sort((a, b) => {
      if (b.cardsLearned !== a.cardsLearned) return b.cardsLearned - a.cardsLearned;
      return b.score - a.score;
    });

    localStorage.setItem(leaderboardKey, JSON.stringify(entries.slice(0, 50))); // Keep top 50

    return res.json({ success: true, leaderboard: entries.slice(0, 10) });
  } catch {
    return res.status(500).json({ error: 'Failed to update leaderboard.' });
  }
});

app.get('/api/sidequest/leaderboard', (_req, res) => {
  const leaderboardKey = 'sidequest_leaderboard';
  const raw = localStorage.getItem(leaderboardKey) || '[]';

  try {
    const entries = JSON.parse(raw) as Array<{ userId: string; cardsLearned: number; score: number; timestamp: number }>;
    return res.json({ leaderboard: entries.slice(0, 10) });
  } catch {
    return res.json({ leaderboard: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
