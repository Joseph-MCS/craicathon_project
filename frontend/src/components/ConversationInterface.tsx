import { useEffect, useRef, useState } from 'react';

type ChatRole = 'assistant' | 'user';
type InputMode = 'text' | 'voice';

type Message = {
  id: string;
  mode: InputMode;
  role: ChatRole;
  text: string;
};

type HistoryMessage = {
  mode: InputMode;
  role: ChatRole;
  text: string;
};

type HealthResponse = {
  configured: boolean;
  models: {
    chat: string;
    transcription: string;
    tts: string;
    ttsProvider?: string;
    voice: string;
  };
  voiceDisclosure: string;
};

type VoiceChatResponse = {
  audioBase64: string;
  audioMimeType: string;
  reply: string;
  voiceDisclosure: string;
  transcript: string;
};

type WordGloss = {
  word: string;
  translation: string;
  note: string;
  dialects: Array<{
    dialect: string;
    pronunciation: string;
  }>;
};

type WordGlossCacheEntry =
  | {
      status: 'loading';
    }
  | {
      status: 'ready';
      data: WordGloss;
    }
  | {
      status: 'error';
      error: string;
    };

type ActiveGloss = {
  cacheKey: string;
  messageId: string;
  tokenIndex: number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const RECORDER_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus'
];
const MESSAGE_TOKEN_REGEX = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*|\s+|[^\s\p{L}\p{M}]+/gu;
const IRISH_WORD_REGEX = /^[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*$/u;
const SESSION_MIN_SPEECH_MS = 140;
const SESSION_SILENCE_MS = 900;
const SESSION_VOLUME_THRESHOLD = 0.035;
const WELCOME_COPY = 'Dia duit. Nuair a thosaíonn tú an seisiún, éistfidh mé leat go leanúnach agus freagróidh mé duit i nGaeilge.';

function createMessage(role: ChatRole, text: string, mode: InputMode): Message {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    mode,
    role,
    text
  };
}

function pickRecorderMimeType(): string | null {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null;
  }

  for (const mimeType of RECORDER_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return '';
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const audioWindow = window as Window &
    typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };

  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result;

      if (typeof result !== 'string') {
        reject(new Error('Failed to read the audio recording.'));
        return;
      }

      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error('Failed to convert the recording.'));
    };

    reader.readAsDataURL(blob);
  });
}

function tokenizeMessageText(text: string): string[] {
  return text.match(MESSAGE_TOKEN_REGEX) ?? [text];
}

function isGlossableWord(token: string): boolean {
  return IRISH_WORD_REGEX.test(token);
}

function buildGlossCacheKey(word: string, context: string): string {
  return `${word.trim().toLocaleLowerCase('ga-IE')}::${context.trim().toLocaleLowerCase('ga-IE')}`;
}

export default function ConversationInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isCapturingSpeech, setIsCapturingSpeech] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [statusText, setStatusText] = useState('Tapáil Tosaigh chun comhrá beo a thosú.');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [canRecord, setCanRecord] = useState(false);
  const [lastAudio, setLastAudio] = useState<{ base64: string; mimeType: string } | null>(null);
  const [glossCache, setGlossCache] = useState<Record<string, WordGlossCacheEntry>>({});
  const [activeGloss, setActiveGloss] = useState<ActiveGloss | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const glossCacheRef = useRef<Record<string, WordGlossCacheEntry>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderMimeTypeRef = useRef('');
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const monitorFrameRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const glossHoverTimerRef = useRef<number | null>(null);
  const sessionCycleRef = useRef(0);
  const activeRequestCycleRef = useRef<number | null>(null);
  const isSessionActiveRef = useRef(false);
  const isCapturingSpeechRef = useRef(false);
  const isBusyRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const discardCurrentRecordingRef = useRef(false);
  const speechDetectedAtRef = useRef<number | null>(null);
  const silenceDetectedAtRef = useRef<number | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    glossCacheRef.current = glossCache;
  }, [glossCache]);

  useEffect(() => {
    setCanRecord(
      typeof window !== 'undefined' &&
        typeof MediaRecorder !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        Boolean(getAudioContextConstructor())
    );
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusText]);

  useEffect(() => {
    void loadHealth();

    return () => {
      clearGlossHoverTimer();
      teardownConversationSession(true);

      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  function clearGlossHoverTimer() {
    if (glossHoverTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(glossHoverTimerRef.current);
      glossHoverTimerRef.current = null;
    }
  }

  function resetSpeechTracking() {
    speechDetectedAtRef.current = null;
    silenceDetectedAtRef.current = null;
  }

  function stopStreamTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function stopAudioMonitoring() {
    if (monitorFrameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(monitorFrameRef.current);
      monitorFrameRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    analyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }

  function teardownConversationSession(silent = false) {
    sessionCycleRef.current += 1;
    activeRequestCycleRef.current = null;
    isSessionActiveRef.current = false;
    isCapturingSpeechRef.current = false;
    isBusyRef.current = false;
    isSpeakingRef.current = false;
    resetSpeechTracking();

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      discardCurrentRecordingRef.current = true;
      recorderRef.current.stop();
    }

    setIsSessionActive(false);
    setIsCapturingSpeech(false);
    setIsBusy(false);
    stopAudioMonitoring();
    stopStreamTracks();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (!silent) {
      setStatusText('Seisiún stoptha. Tapáil Tosaigh nuair atá tú réidh arís.');
    }
  }

  function buildHistory(): HistoryMessage[] {
    return messagesRef.current.slice(-10).map((message) => ({
      mode: message.mode,
      role: message.role,
      text: message.text
    }));
  }

  async function loadHealth() {
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      const payload = (await response.json()) as HealthResponse;
      setHealth(payload);

      if (!payload.configured) {
        setErrorText('OPENAI_API_KEY is missing on the backend.');
      }
    } catch (error) {
      console.error(error);
      setErrorText('Could not reach the backend. Start the server and refresh the page.');
    }
  }

  async function playAudio(base64: string, mimeType: string) {
    setLastAudio({ base64, mimeType });
    isSpeakingRef.current = true;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(`data:${mimeType};base64,${base64}`);
    audioRef.current = audio;

    audio.onended = () => {
      isSpeakingRef.current = false;
      setStatusText(
        isSessionActiveRef.current ? 'Seisiún beo. Labhair nuair atá tú réidh arís.' : 'Réidh don chéad bhabhta eile.'
      );
    };

    audio.onerror = () => {
      isSpeakingRef.current = false;
      setStatusText(
        isSessionActiveRef.current
          ? 'Tá an freagra réidh. Seinn arís más gá, agus lean ort ag labhairt.'
          : 'Tá an freagra réidh. Tapáil Seinn arís chun éisteacht.'
      );
    };

    try {
      await audio.play();
      setStatusText('Ag caint anois...');
    } catch (error) {
      console.error(error);
      isSpeakingRef.current = false;
      setStatusText(
        isSessionActiveRef.current
          ? 'Freagra réidh. Tapáil Seinn arís más gá, agus lean ort leis an gcomhrá.'
          : 'Freagra réidh. Tapáil Seinn arís chun éisteacht.'
      );
    }
  }

  async function sendVoiceMessage(blob: Blob, sessionCycle: number) {
    const mimeType = blob.type || 'audio/webm';
    const history = buildHistory();
    const requestSessionCycle = sessionCycle;

    setErrorText(null);
    activeRequestCycleRef.current = requestSessionCycle;
    isBusyRef.current = true;
    setIsBusy(true);
    setStatusText('Ag tras-scríobh do chuid Gaeilge...');

    try {
      const audioBase64 = await blobToBase64(blob);
      const response = await fetch(`${API_BASE}/api/voice-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioBase64,
          history,
          mimeType
        })
      });
      const payload = (await response.json()) as VoiceChatResponse | { error?: string };

      if (!response.ok) {
        throw new Error(typeof payload === 'object' && payload && 'error' in payload ? payload.error : 'Voice chat failed.');
      }

      if (requestSessionCycle !== sessionCycleRef.current) {
        return;
      }

      const successPayload = payload as VoiceChatResponse;
      const userMessage = createMessage('user', successPayload.transcript, 'voice');
      const assistantMessage = createMessage('assistant', successPayload.reply, 'voice');

      setMessages((currentMessages) => [...currentMessages, userMessage, assistantMessage]);
      setStatusText('Freagra cruthaithe. Ag ullmhú an ghutha...');
      await playAudio(successPayload.audioBase64, successPayload.audioMimeType);
    } catch (error) {
      console.error(error);

      if (requestSessionCycle === sessionCycleRef.current) {
        setErrorText(error instanceof Error ? error.message : 'Voice chat failed.');
        setStatusText('Theip ar an gcomhrá beo. Bain triail eile as le frása níos giorra.');
      }
    } finally {
      if (activeRequestCycleRef.current === requestSessionCycle) {
        activeRequestCycleRef.current = null;
        isBusyRef.current = false;
        setIsBusy(false);
      }
    }
  }

  function stopSegmentRecording(discard = false) {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') {
      return;
    }

    discardCurrentRecordingRef.current = discard;
    recorderRef.current.stop();
  }

  function beginSegmentRecording() {
    if (!streamRef.current || isCapturingSpeechRef.current || isBusyRef.current || isSpeakingRef.current) {
      return;
    }

    const mimeType = recorderMimeTypeRef.current;
    const recorder = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current);

    recorderRef.current = recorder;
    chunksRef.current = [];
    discardCurrentRecordingRef.current = false;
    isCapturingSpeechRef.current = true;
    setIsCapturingSpeech(true);
    setStatusText('Táim ag éisteacht leat anois...');

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onerror = () => {
      recorderRef.current = null;
      chunksRef.current = [];
      discardCurrentRecordingRef.current = false;
      isCapturingSpeechRef.current = false;
      setIsCapturingSpeech(false);
      setErrorText('The live listening session hit a recording problem. Stop and start again.');
      setStatusText('Bhí fadhb leis an taifeadadh beo. Stop agus tosaigh arís.');
    };

    recorder.onstop = async () => {
      const shouldDiscard = discardCurrentRecordingRef.current;
      const finalMimeType = recorder.mimeType || mimeType || 'audio/webm';
      const audioBlob = new Blob(chunksRef.current, { type: finalMimeType });

      recorderRef.current = null;
      chunksRef.current = [];
      discardCurrentRecordingRef.current = false;
      isCapturingSpeechRef.current = false;
      setIsCapturingSpeech(false);
      resetSpeechTracking();

      if (shouldDiscard || audioBlob.size === 0) {
        if (isSessionActiveRef.current) {
          setStatusText('Seisiún beo. Labhair nuair atá tú réidh arís.');
        }
        return;
      }

      await sendVoiceMessage(audioBlob, sessionCycleRef.current);
    };

    recorder.start();
  }

  function monitorConversationSession() {
    if (typeof window === 'undefined' || !isSessionActiveRef.current || !analyserRef.current) {
      return;
    }

    const analyser = analyserRef.current;
    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);

    let sumSquares = 0;

    for (const sample of samples) {
      const normalizedSample = (sample - 128) / 128;
      sumSquares += normalizedSample * normalizedSample;
    }

    const rms = Math.sqrt(sumSquares / samples.length);
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    if (isBusyRef.current || isSpeakingRef.current) {
      resetSpeechTracking();
    } else if (rms >= SESSION_VOLUME_THRESHOLD) {
      silenceDetectedAtRef.current = null;

      if (!isCapturingSpeechRef.current) {
        if (speechDetectedAtRef.current === null) {
          speechDetectedAtRef.current = now;
        }

        if (now - speechDetectedAtRef.current >= SESSION_MIN_SPEECH_MS) {
          beginSegmentRecording();
        }
      }
    } else {
      speechDetectedAtRef.current = null;

      if (isCapturingSpeechRef.current) {
        if (silenceDetectedAtRef.current === null) {
          silenceDetectedAtRef.current = now;
        }

        if (now - silenceDetectedAtRef.current >= SESSION_SILENCE_MS) {
          stopSegmentRecording(false);
        }
      }
    }

    monitorFrameRef.current = window.requestAnimationFrame(monitorConversationSession);
  }

  async function startConversationSession() {
    if (isSessionActiveRef.current || isBusyRef.current) {
      return;
    }

    if (!health?.configured) {
      setErrorText('The backend is not configured with OPENAI_API_KEY yet.');
      return;
    }

    const supportedMimeType = pickRecorderMimeType();

    if (supportedMimeType === null) {
      setErrorText('This browser does not support the always-on voice mode used by the app.');
      return;
    }

    const AudioContextConstructor = getAudioContextConstructor();

    if (!AudioContextConstructor) {
      setErrorText('This browser does not support live microphone monitoring for the always-on mode.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      const audioContext = new AudioContextConstructor();
      const sourceNode = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      sourceNode.connect(analyser);

      if (audioContext.state === 'suspended') {
        await audioContext.resume().catch(() => undefined);
      }

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceNodeRef.current = sourceNode;
      analyserRef.current = analyser;
      recorderMimeTypeRef.current = supportedMimeType;
      sessionCycleRef.current += 1;
      isSessionActiveRef.current = true;
      setIsSessionActive(true);
      setErrorText(null);
      setStatusText('Seisiún beo. Labhair go nádúrtha agus freagróidh mé go huathoibríoch.');

      monitorConversationSession();
    } catch (error) {
      console.error(error);
      teardownConversationSession(true);
      setErrorText('Microphone access was denied or unavailable.');
      setStatusText('Níor éirigh liom an seisiún beo a thosú.');
    }
  }

  function stopConversationSession() {
    teardownConversationSession(false);
  }

  async function replayLastAudio() {
    if (!lastAudio) {
      return;
    }

    await playAudio(lastAudio.base64, lastAudio.mimeType);
  }

  async function loadGloss(word: string, context: string, cacheKey: string) {
    const existingEntry = glossCacheRef.current[cacheKey];

    if (existingEntry?.status === 'loading' || existingEntry?.status === 'ready') {
      return;
    }

    setGlossCache((currentCache) => ({
      ...currentCache,
      [cacheKey]: {
        status: 'loading'
      }
    }));

    try {
      const response = await fetch(`${API_BASE}/api/word-gloss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          context,
          word
        })
      });
      const payload = (await response.json()) as WordGloss | { error?: string };

      if (!response.ok) {
        throw new Error(typeof payload === 'object' && payload && 'error' in payload ? payload.error : 'Word lookup failed.');
      }

      setGlossCache((currentCache) => ({
        ...currentCache,
        [cacheKey]: {
          data: payload as WordGloss,
          status: 'ready'
        }
      }));
    } catch (error) {
      console.error(error);
      setGlossCache((currentCache) => ({
        ...currentCache,
        [cacheKey]: {
          error: error instanceof Error ? error.message : 'Word lookup failed.',
          status: 'error'
        }
      }));
    }
  }

  function activateGloss(word: string, context: string, messageId: string, tokenIndex: number, immediate = false) {
    const cacheKey = buildGlossCacheKey(word, context);
    const showGloss = () => {
      setActiveGloss({
        cacheKey,
        messageId,
        tokenIndex
      });
      void loadGloss(word, context, cacheKey);
    };

    clearGlossHoverTimer();

    if (immediate || typeof window === 'undefined') {
      showGloss();
      return;
    }

    glossHoverTimerRef.current = window.setTimeout(showGloss, 180);
  }

  function dismissGloss() {
    clearGlossHoverTimer();
    setActiveGloss(null);
  }

  function renderGlossCard(cacheKey: string, fallbackWord: string) {
    const glossEntry = glossCache[cacheKey];

    if (!glossEntry || glossEntry.status === 'loading') {
      return (
        <div className="gloss-popover" role="status">
          <p className="gloss-word-heading">{fallbackWord}</p>
          <p className="gloss-loading">Ag lorg míniúcháin...</p>
        </div>
      );
    }

    if (glossEntry.status === 'error') {
      return (
        <div className="gloss-popover" role="status">
          <p className="gloss-word-heading">{fallbackWord}</p>
          <p className="gloss-error">{glossEntry.error}</p>
        </div>
      );
    }

    return (
      <div className="gloss-popover" role="status">
        <p className="gloss-word-heading">{glossEntry.data.word}</p>
        <p className="gloss-translation">{glossEntry.data.translation}</p>
        <ul className="gloss-dialects">
          {glossEntry.data.dialects.map((dialect) => (
            <li key={`${glossEntry.data.word}-${dialect.dialect}`}>
              <span>{dialect.dialect}</span>
              <strong>{dialect.pronunciation}</strong>
            </li>
          ))}
        </ul>
        {glossEntry.data.note ? <p className="gloss-note">{glossEntry.data.note}</p> : null}
      </div>
    );
  }

  function renderMessageText(message: Message) {
    return tokenizeMessageText(message.text).map((token, tokenIndex) => {
      if (!isGlossableWord(token)) {
        return <span key={`${message.id}-token-${tokenIndex}`}>{token}</span>;
      }

      const cacheKey = buildGlossCacheKey(token, message.text);
      const isActive = activeGloss?.messageId === message.id && activeGloss.tokenIndex === tokenIndex;

      return (
        <span
          key={`${message.id}-token-${tokenIndex}`}
          className={`gloss-word-wrap ${isActive ? 'is-active' : ''}`}
          onBlur={dismissGloss}
          onFocus={() => activateGloss(token, message.text, message.id, tokenIndex, true)}
          onMouseEnter={() => activateGloss(token, message.text, message.id, tokenIndex)}
          onMouseLeave={dismissGloss}
        >
          <span
            aria-label={`Show help for ${token}`}
            className={`gloss-word ${isActive ? 'is-active' : ''}`}
            onClick={() => activateGloss(token, message.text, message.id, tokenIndex, true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activateGloss(token, message.text, message.id, tokenIndex, true);
              }
            }}
            role="button"
            tabIndex={0}
          >
            {token}
          </span>
          {isActive ? renderGlossCard(cacheKey, token) : null}
        </span>
      );
    });
  }

  return (
    <main className="shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Comrádaí gutha Gaeilge</p>
          <h1>Labhair Linn</h1>
          <p className="lede">
            Tosaigh an seisiún uair amháin, labhair go nádúrtha, agus fanfaidh
            an comhrá beo. Nuair a stopann tú ag caint, freagróidh an aip leat
            go huathoibríoch.
          </p>
        </div>
      </section>

      <section className="workspace">
        <section className="chat-panel">
          <div className="chat-header">
            <div>
              <h2>Comhrá</h2>
              <p>{statusText}</p>
            </div>
          </div>

          <div className="chat-scroll">
            {messages.length === 0 ? (
              <div className="empty-state">
                <p>{WELCOME_COPY}</p>
                <p>Moltar cluasáin a úsáid chun macalla idir do ghuth agus freagra an aip a laghdú.</p>
              </div>
            ) : (
              messages.map((message) => (
                <article key={message.id} className={`message-card ${message.role}`}>
                  <span className="message-meta">{message.mode === 'voice' ? 'Guth' : 'Clóscríofa'}</span>
                  <p>{renderMessageText(message)}</p>
                </article>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="composer-panel">
            <div className="voice-controls">
              <button
                className={`record-button session-button ${isSessionActive ? 'is-stop' : 'is-start'} ${
                  isCapturingSpeech ? 'is-live' : ''
                }`}
                disabled={!isSessionActive && (!canRecord || isBusy || !health?.configured)}
                onClick={() => void (isSessionActive ? stopConversationSession() : startConversationSession())}
                type="button"
              >
                {isSessionActive ? 'Stop' : 'Tosaigh'}
              </button>

              {lastAudio ? (
                <button className="secondary-button" disabled={isBusy} onClick={() => void replayLastAudio()} type="button">
                  Seinn arís
                </button>
              ) : null}

              <p className="hint">
                {canRecord
                  ? 'Nuair atá an seisiún beo, éisteann an aip le sosanna nádúrtha, cuireann sí do chuid focal sa chomhrá, agus freagraíonn sí ar ais gan cnaipe eile.'
                  : 'Ní thacaíonn an brabhsálaí seo leis an modh comhrá beo a úsáideann an aip.'}
              </p>
            </div>
          </div>

          {errorText ? (
            <section className="inline-note error-card">
              <p>{errorText}</p>
            </section>
          ) : null}

          <section className="inline-note subtle-note">
            <p>{health?.voiceDisclosure ?? 'The spoken reply uses an AI-generated voice.'}</p>
          </section>
        </section>
      </section>
    </main>
  );
}
