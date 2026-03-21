import type { IncomingMessage, ServerResponse } from 'http';

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim() || '';
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

function json(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function getRequestPath(req: IncomingMessage): string {
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${host}`);
  return url.pathname;
}

function resolveOpenAIKey(req: IncomingMessage): string | null {
  const headerValue = req.headers['x-openai-api-key'];
  const headerKey = Array.isArray(headerValue) ? headerValue[0]?.trim() : headerValue?.trim();

  if (headerKey) {
    return headerKey;
  }

  return OPENAI_API_KEY || null;
}

function ensureConfigured(apiKey: string | null): asserts apiKey is string {
  if (!apiKey) {
    throw new Error('OpenAI API key is missing. Add OPENAI_API_KEY in Vercel env or provide one in app settings.');
  }
}

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

  if (normalizedMimeType === 'audio/mp4') return 'mp4';
  if (normalizedMimeType === 'audio/mpeg') return 'mp3';
  if (normalizedMimeType === 'audio/ogg') return 'ogg';
  if (normalizedMimeType === 'audio/wav') return 'wav';

  return 'webm';
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const reqWithBody = req as IncomingMessage & { body?: unknown };

  if (typeof reqWithBody.body === 'object' && reqWithBody.body !== null) {
    return reqWithBody.body as Record<string, unknown>;
  }

  if (typeof reqWithBody.body === 'string') {
    return JSON.parse(reqWithBody.body) as Record<string, unknown>;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as Record<string, unknown>;
}

async function transcribeIrishAudio(audioBase64: string, mimeType: string, apiKey: string): Promise<string> {
  const audioBuffer = Buffer.from(audioBase64, 'base64');

  if (audioBuffer.length === 0) {
    throw new Error('No audio was received. Please try recording again.');
  }

  if (audioBuffer.length > MAX_AUDIO_BYTES) {
    throw new Error('That recording is too large. Keep clips short and try again.');
  }

  const formData = new FormData();
  const fileExtension = extensionFromMimeType(mimeType);

  formData.append('file', new Blob([audioBuffer], { type: mimeType || 'audio/webm' }), `irish-clip.${fileExtension}`);
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
      Authorization: `Bearer ${apiKey}`
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

async function generateIrishReply(message: string, history: ClientMessage[], apiKey: string): Promise<string> {
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
      Authorization: `Bearer ${apiKey}`,
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

async function translateIrishToEnglish(text: string, apiKey: string): Promise<string> {
  const response = await fetch(`${OPENAI_API_BASE}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_output_tokens: 80,
      reasoning: {
        effort: 'minimal'
      },
      instructions:
        'You translate Irish (Gaeilge) words and short phrases into English. Return only the best natural English translation with no explanation or extra formatting.',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text
            }
          ]
        }
      ]
    })
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(extractOpenAIError(payload));
  }

  const translation = readResponseText(payload);
  if (!translation) {
    throw new Error('OpenAI returned an empty translation.');
  }

  return translation;
}

async function generateIrishPhoneticPronunciation(text: string, apiKey: string): Promise<string> {
  const response = await fetch(`${OPENAI_API_BASE}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_output_tokens: 80,
      reasoning: {
        effort: 'minimal'
      },
      instructions: [
        'You convert Irish (Gaeilge) words and short phrases into easy phonetic pronunciation for English speakers.',
        'Return only the phonetic pronunciation string.',
        'Do not include IPA, labels, punctuation wrappers, or explanations.'
      ].join(' '),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text
            }
          ]
        }
      ]
    })
  });

  const payload = (await response.json()) as OpenAIResponsePayload;

  if (!response.ok) {
    throw new Error(extractOpenAIError(payload));
  }

  const pronunciation = readResponseText(payload);
  if (!pronunciation) {
    throw new Error('OpenAI returned an empty pronunciation.');
  }

  return pronunciation;
}

async function synthesizeIrishReply(text: string, apiKey: string): Promise<{ audioBase64: string; audioMimeType: string }> {
  const response = await fetch(`${OPENAI_API_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: text,
      instructions:
        'Speak warmly, clearly, and at a measured pace for an Irish language learner. Pronounce Irish words as carefully as possible.',
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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();
  const path = getRequestPath(req);

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (path === '/api/health' && method === 'GET') {
    const apiKey = resolveOpenAIKey(req);

    json(res, 200, {
      configured: Boolean(apiKey),
      models: {
        chat: CHAT_MODEL,
        transcription: TRANSCRIPTION_MODEL,
        tts: TTS_MODEL,
        voice: TTS_VOICE
      },
      voiceDisclosure: VOICE_DISCLOSURE
    });
    return;
  }

  if (path === '/api/chat' && method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      const history = sanitizeHistory(body.history);
      const apiKey = resolveOpenAIKey(req);

      if (!message) {
        json(res, 400, { error: 'Message text is required.' });
        return;
      }

      ensureConfigured(apiKey);
      const reply = await generateIrishReply(message, history, apiKey);
      const speech = await synthesizeIrishReply(reply, apiKey);

      json(res, 200, {
        ...speech,
        reply,
        voiceDisclosure: VOICE_DISCLOSURE
      });
      return;
    } catch (error) {
      console.error('Chat pipeline failed:', error);
      json(res, 500, { error: getErrorMessage(error) });
      return;
    }
  }

  if (path === '/api/voice-chat' && method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64.trim() : '';
      const mimeType = typeof body.mimeType === 'string' && body.mimeType.trim() ? body.mimeType.trim() : 'audio/webm';
      const history = sanitizeHistory(body.history);
      const apiKey = resolveOpenAIKey(req);

      if (!audioBase64) {
        json(res, 400, { error: 'Audio data is required.' });
        return;
      }

      ensureConfigured(apiKey);
      const transcript = await transcribeIrishAudio(audioBase64, mimeType, apiKey);
      const reply = await generateIrishReply(transcript, history, apiKey);
      const speech = await synthesizeIrishReply(reply, apiKey);

      json(res, 200, {
        ...speech,
        reply,
        transcript,
        voiceDisclosure: VOICE_DISCLOSURE
      });
      return;
    } catch (error) {
      console.error('Voice pipeline failed:', error);
      json(res, 500, { error: getErrorMessage(error) });
      return;
    }
  }

  if (path === '/api/translate' && method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      const apiKey = resolveOpenAIKey(req);

      if (!text) {
        json(res, 400, { error: 'Text is required.' });
        return;
      }

      if (text.length > 280) {
        json(res, 400, { error: 'Text is too long. Select a short word or phrase.' });
        return;
      }

      ensureConfigured(apiKey);
      const [translation, pronunciation] = await Promise.all([
        translateIrishToEnglish(text, apiKey),
        generateIrishPhoneticPronunciation(text, apiKey)
      ]);

      json(res, 200, {
        translation,
        pronunciation
      });
      return;
    } catch (error) {
      console.error('Translation failed:', error);
      json(res, 500, { error: getErrorMessage(error) });
      return;
    }
  }

  if (path === '/api/pronunciation' && method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      const apiKey = resolveOpenAIKey(req);

      if (!text) {
        json(res, 400, { error: 'Text is required.' });
        return;
      }

      if (text.length > 280) {
        json(res, 400, { error: 'Text is too long. Select a short word or phrase.' });
        return;
      }

      ensureConfigured(apiKey);
      const pronunciation = await generateIrishPhoneticPronunciation(text, apiKey);

      json(res, 200, {
        pronunciation
      });
      return;
    } catch (error) {
      console.error('Pronunciation failed:', error);
      json(res, 500, { error: getErrorMessage(error) });
      return;
    }
  }

  if (path === '/api/speak' && method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      const apiKey = resolveOpenAIKey(req);

      if (!text) {
        json(res, 400, { error: 'Text is required.' });
        return;
      }

      if (text.length > 600) {
        json(res, 400, { error: 'Text is too long.' });
        return;
      }

      ensureConfigured(apiKey);
      const speech = await synthesizeIrishReply(text, apiKey);

      json(res, 200, {
        ...speech,
        voiceDisclosure: VOICE_DISCLOSURE
      });
      return;
    } catch (error) {
      console.error('Speech synthesis failed:', error);
      json(res, 500, { error: getErrorMessage(error) });
      return;
    }
  }

  json(res, 404, { error: 'Not found.' });
}
