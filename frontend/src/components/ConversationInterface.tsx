import { FormEvent, useEffect, useRef, useState } from 'react';

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
    voice: string;
  };
  voiceDisclosure: string;
};

type TextChatResponse = {
  audioBase64: string;
  audioMimeType: string;
  reply: string;
  voiceDisclosure: string;
};

type VoiceChatResponse = TextChatResponse & {
  transcript: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const RECORDER_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus'
];
const WELCOME_COPY = 'Dia duit. Labhair liom as Gaeilge agus freagróidh mé leat i nGaeilge, le guth AI.';

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

export default function ConversationInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusText, setStatusText] = useState('Tap the mic, speak Irish, and I will answer out loud.');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [canRecord, setCanRecord] = useState(false);
  const [lastAudio, setLastAudio] = useState<{ base64: string; mimeType: string } | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setCanRecord(
      typeof window !== 'undefined' &&
        typeof MediaRecorder !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia)
    );
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusText]);

  useEffect(() => {
    void loadHealth();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      stopStreamTracks();
    };
  }, []);

  function stopStreamTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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

  function buildHistory(): HistoryMessage[] {
    return messagesRef.current.slice(-10).map((message) => ({
      mode: message.mode,
      role: message.role,
      text: message.text
    }));
  }

  async function playAudio(base64: string, mimeType: string) {
    setLastAudio({ base64, mimeType });
    setIsSpeaking(true);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(`data:${mimeType};base64,${base64}`);
    audioRef.current = audio;

    audio.onended = () => {
      setIsSpeaking(false);
      setStatusText('Réidh don chéad abairt eile.');
    };

    audio.onerror = () => {
      setIsSpeaking(false);
      setStatusText('The reply is ready. Tap replay if autoplay was blocked.');
    };

    try {
      await audio.play();
      setStatusText('Ag caint anois...');
    } catch (error) {
      console.error(error);
      setIsSpeaking(false);
      setStatusText('The reply is ready. Tap replay to hear it.');
    }
  }

  async function sendTextMessage(message: string) {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    const userMessage = createMessage('user', trimmedMessage, 'text');
    const history = buildHistory();

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInputText('');
    setErrorText(null);
    setIsBusy(true);
    setStatusText('Cumadóireacht ar an bhfreagra...');

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          history,
          message: trimmedMessage
        })
      });
      const payload = (await response.json()) as TextChatResponse | { error?: string };

      if (!response.ok) {
        throw new Error(typeof payload === 'object' && payload && 'error' in payload ? payload.error : 'Chat failed.');
      }

      const successPayload = payload as TextChatResponse;
      const assistantMessage = createMessage('assistant', successPayload.reply, 'text');
      setMessages((currentMessages) => [...currentMessages, assistantMessage]);
      await playAudio(successPayload.audioBase64, successPayload.audioMimeType);
    } catch (error) {
      console.error(error);
      setErrorText(error instanceof Error ? error.message : 'Chat failed.');
      setStatusText('Something went wrong. Try again in a moment.');
    } finally {
      setIsBusy(false);
    }
  }

  async function sendVoiceMessage(blob: Blob) {
    const mimeType = blob.type || 'audio/webm';
    const history = buildHistory();

    setErrorText(null);
    setIsBusy(true);
    setStatusText('Transcribing your Irish...');

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

      const successPayload = payload as VoiceChatResponse;
      const userMessage = createMessage('user', successPayload.transcript, 'voice');
      const assistantMessage = createMessage('assistant', successPayload.reply, 'voice');

      setMessages((currentMessages) => [...currentMessages, userMessage, assistantMessage]);
      setStatusText('Freagra cruthaithe. Ag ullmhú an ghutha...');
      await playAudio(successPayload.audioBase64, successPayload.audioMimeType);
    } catch (error) {
      console.error(error);
      setErrorText(error instanceof Error ? error.message : 'Voice chat failed.');
      setStatusText('Something went wrong. Try a shorter Irish clip.');
    } finally {
      setIsBusy(false);
    }
  }

  async function startRecording() {
    if (isBusy || isRecording) {
      return;
    }

    if (!health?.configured) {
      setErrorText('The backend is not configured with OPENAI_API_KEY yet.');
      return;
    }

    const supportedMimeType = pickRecorderMimeType();

    if (supportedMimeType === null) {
      setErrorText('This browser does not support microphone recording for this app.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const finalMimeType = recorder.mimeType || supportedMimeType || 'audio/webm';
        const audioBlob = new Blob(chunksRef.current, { type: finalMimeType });

        setIsRecording(false);
        recorderRef.current = null;
        stopStreamTracks();

        if (audioBlob.size === 0) {
          setStatusText('No audio captured. Try again and speak for a moment.');
          return;
        }

        await sendVoiceMessage(audioBlob);
      };

      recorder.onerror = () => {
        setIsRecording(false);
        stopStreamTracks();
        setErrorText('Recording failed. Please refresh and try again.');
      };

      recorder.start();
      setIsRecording(true);
      setErrorText(null);
      setStatusText('Listening now. Speak Irish, then tap stop.');
    } catch (error) {
      console.error(error);
      setErrorText('Microphone access was denied or unavailable.');
    }
  }

  function stopRecording() {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') {
      return;
    }

    setStatusText('Sending your Irish to OpenAI...');
    recorderRef.current.stop();
  }

  async function replayLastAudio() {
    if (!lastAudio) {
      return;
    }

    await playAudio(lastAudio.base64, lastAudio.mimeType);
  }

  function handleTextSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendTextMessage(inputText);
  }

  const readyLabel = isRecording ? 'Recording' : isBusy ? 'Working' : isSpeaking ? 'Speaking' : 'Ready';

  return (
    <main className="shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Irish voice companion</p>
          <h1>An Chomhrá Beo</h1>
          <p className="lede">
            Speak Irish into your microphone. The app transcribes it, drops the transcript into the chat, writes back in
            Irish, and answers you out loud.
          </p>
        </div>

        <div className="signal-row">
          <span className={`pill ${health?.configured ? 'pill-ready' : 'pill-warn'}`}>
            {health?.configured ? 'OpenAI key found' : 'Backend not configured'}
          </span>
          <span className={`pill ${isRecording ? 'pill-recording' : 'pill-calm'}`}>{readyLabel}</span>
        </div>
      </section>

      <section className="workspace">
        <section className="chat-panel">
          <div className="chat-header">
            <div>
              <h2>Conversation</h2>
              <p>{statusText}</p>
            </div>
            <button className="secondary-button" onClick={() => void replayLastAudio()} disabled={!lastAudio || isBusy}>
              Replay last reply
            </button>
          </div>

          <div className="chat-scroll">
            {messages.length === 0 ? (
              <div className="empty-state">
                <p>{WELCOME_COPY}</p>
                <p>Best results come from short Irish clips and clear pronunciation.</p>
              </div>
            ) : (
              messages.map((message) => (
                <article key={message.id} className={`message-card ${message.role}`}>
                  <span className="message-meta">{message.mode === 'voice' ? 'Voice transcript' : 'Typed line'}</span>
                  <p>{message.text}</p>
                </article>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="composer-panel">
            <div className="voice-controls">
              <button
                className={`record-button ${isRecording ? 'is-active' : ''}`}
                disabled={!canRecord || isBusy || !health?.configured}
                onClick={() => void (isRecording ? stopRecording() : startRecording())}
                type="button"
              >
                {isRecording ? 'Stop recording' : 'Speak Irish'}
              </button>
              <p className="hint">
                {canRecord
                  ? 'Record a short Irish line, then wait for the transcript and spoken reply.'
                  : 'This browser does not support the recording flow used by the app.'}
              </p>
            </div>

            <form className="text-form" onSubmit={handleTextSubmit}>
              <label className="text-label" htmlFor="irish-text">
                Or type your Irish
              </label>
              <div className="text-row">
                <input
                  disabled={isBusy}
                  id="irish-text"
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder="Scríobh teachtaireacht ghearr anseo..."
                  type="text"
                  value={inputText}
                />
                <button className="send-button" disabled={!inputText.trim() || isBusy || !health?.configured} type="submit">
                  Send
                </button>
              </div>
            </form>
          </div>
        </section>

        <aside className="side-panel">
          <section className="info-card">
            <h3>System</h3>
            <dl className="stack-list">
              <div>
                <dt>Transcription</dt>
                <dd>{health?.models.transcription ?? 'Checking...'}</dd>
              </div>
              <div>
                <dt>Chat</dt>
                <dd>{health?.models.chat ?? 'Checking...'}</dd>
              </div>
              <div>
                <dt>Speech</dt>
                <dd>
                  {health?.models.tts ?? 'Checking...'} / {health?.models.voice ?? '...'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="info-card">
            <h3>What to expect</h3>
            <p>Irish is best-effort here, so it is worth testing with short clips first and checking the transcript carefully.</p>
            <p>Typed messages also come back with spoken replies, which helps when you want to retry a phrase without recording again.</p>
          </section>

          <section className="info-card">
            <h3>Disclosure</h3>
            <p>{health?.voiceDisclosure ?? 'The spoken reply uses an AI-generated voice.'}</p>
          </section>

          {errorText ? (
            <section className="info-card error-card">
              <h3>Issue</h3>
              <p>{errorText}</p>
            </section>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
