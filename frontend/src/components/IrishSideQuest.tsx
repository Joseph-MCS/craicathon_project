import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

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

type RawSlangCard = Partial<SlangCard>;

type QuizQuestion = {
  cardId: string;
  prompt: string;
  options: string[];
  answer: string;
};

type CardView = 'unlocked' | 'saved' | 'learned';
type TabView = 'cards' | 'leaderboard' | 'seasonal';

type LeaderboardEntry = {
  userId: string;
  cardsLearned: number;
  score: number;
  timestamp: number;
};

const CARDS_PER_PAGE = 2;

const FAVORITES_KEY = 'sidequest_favorites';
const LEARNED_KEY = 'sidequest_learned';
const UNLOCKED_KEY = 'sidequest_unlocked';
const CONVERSATION_FLASHCARD_STORAGE_KEY = 'craicathon.flashcards.v1';

type ConversationFlashcard = {
  id?: unknown;
  front?: unknown;
  back?: unknown;
  irish?: unknown;
  english?: unknown;
  pronunciation?: unknown;
};
const USER_ID_KEY = 'sidequest_user_id';
const VOICE_RECORDINGS_KEY = 'sidequest_voice_recordings';
const USER_OPENAI_KEY_STORAGE_KEY = 'craicathon.user_openai_key.v1';

function buildOpenAIHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const storedKey = localStorage.getItem(USER_OPENAI_KEY_STORAGE_KEY)?.trim();
  if (storedKey) {
    headers['x-openai-api-key'] = storedKey;
  }

  return headers;
}

function readSet(key: string): Set<string> {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set<string>();
  }
}

function writeSet(key: string, values: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...values]));
}

function normalizeCardText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function fetchPhoneticPronunciation(phrase: string): Promise<string> {
  const response = await fetch('/api/pronunciation', {
    method: 'POST',
    headers: buildOpenAIHeaders(),
    body: JSON.stringify({ text: phrase })
  });
  const payload = (await response.json()) as { pronunciation?: string; error?: string };

  if (!response.ok) {
    throw new Error(payload.error || 'Pronunciation request failed.');
  }

  return typeof payload.pronunciation === 'string' && payload.pronunciation.trim()
    ? payload.pronunciation.trim()
    : 'Use Hear it and repeat phrase-by-phrase.';
}

function loadConversationFlashcards(): SlangCard[] {
  const raw = localStorage.getItem(CONVERSATION_FLASHCARD_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): SlangCard | null => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }

        const card = item as ConversationFlashcard;
        const phrase = normalizeCardText(card.front) || normalizeCardText(card.irish);
        const meaning = normalizeCardText(card.back) || normalizeCardText(card.english);
        const pronunciation = normalizeCardText(card.pronunciation);
        const rawId = normalizeCardText(card.id);

        if (!phrase || !meaning) {
          return null;
        }

        const fallbackId = `${phrase.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}-${meaning
          .toLocaleLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 24)}`;

        return {
          id: `conversation-${rawId || fallbackId}`,
          phrase,
          pronunciation: pronunciation || 'Use Hear it and repeat phrase-by-phrase.',
          meaning,
          whenToUse: 'Use this in similar conversation contexts from your practice chat.',
          example: `${phrase} -> ${meaning}`,
          cultureNote: 'Saved from your AI conversation flashcard bank.',
          wordBreakdown: []
        };
      })
      .filter((card): card is SlangCard => card !== null);
  } catch {
    return [];
  }
}

function persistConversationPronunciations(updates: Array<{ phrase: string; pronunciation: string }>) {
  if (updates.length === 0) {
    return;
  }

  const raw = localStorage.getItem(CONVERSATION_FLASHCARD_STORAGE_KEY);

  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return;
    }

    const pronunciationByPhrase = new Map(
      updates.map((item) => [item.phrase.toLocaleLowerCase(), item.pronunciation])
    );

    const normalized = parsed.map((item) => {
      if (typeof item !== 'object' || item === null) {
        return item;
      }

      const record = item as Record<string, unknown>;
      const phrase = normalizeCardText(record.front) || normalizeCardText(record.irish);
      const mappedPronunciation = pronunciationByPhrase.get(phrase.toLocaleLowerCase());

      if (!mappedPronunciation) {
        return item;
      }

      return {
        ...record,
        pronunciation: mappedPronunciation
      };
    });

    localStorage.setItem(CONVERSATION_FLASHCARD_STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.error('Failed to persist conversation pronunciations', error);
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function speakIrishFallback(text: string) {
  if (!('speechSynthesis' in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ga-IE';
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

async function speakIrish(text: string): Promise<void> {
  try {
    const response = await fetch('/api/speak', {
      method: 'POST',
      headers: buildOpenAIHeaders(),
      body: JSON.stringify({ text })
    });

    const payload = (await response.json()) as { audioBase64?: string; audioMimeType?: string; error?: string };

    if (!response.ok || !payload.audioBase64) {
      throw new Error(payload.error || 'Speech request failed.');
    }

    const audio = new Audio(`data:${payload.audioMimeType || 'audio/mpeg'};base64,${payload.audioBase64}`);
    await audio.play();
  } catch (error) {
    console.error('OpenAI speech failed, using browser voice fallback:', error);
    speakIrishFallback(text);
  }
}

function normalizeCard(raw: RawSlangCard): SlangCard {
  const defaultBreakdown = (raw.phrase || '')
    .replace(/[!?.,]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({
      irish: word,
      soundLike: '(listen)',
      tip: 'Tap Hear it and repeat slowly.'
    }));

  return {
    id: raw.id || '',
    phrase: raw.phrase || '',
    pronunciation: raw.pronunciation || 'Use "Hear it" to listen.',
    meaning: raw.meaning || '',
    whenToUse: raw.whenToUse || '',
    example: raw.example || '',
    cultureNote: raw.cultureNote || '',
    wordBreakdown: raw.wordBreakdown && raw.wordBreakdown.length > 0
      ? raw.wordBreakdown
      : defaultBreakdown,
    regions: raw.regions,
    scenario: raw.scenario,
    historyNote: raw.historyNote,
    isSeasonalCard: raw.isSeasonalCard ?? false,
    seasonalType: raw.seasonalType ?? null
  };
}

export default function IrishSideQuest() {
  const [cards, setCards] = useState<SlangCard[]>([]);
  const [dailyCard, setDailyCard] = useState<SlangCard | null>(null);
  const [seasonalCards, setSeasonalCards] = useState<SlangCard[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [learned, setLearned] = useState<Set<string>>(new Set());
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [cardView, setCardView] = useState<CardView>('unlocked');
  const [tabView, setTabView] = useState<TabView>('cards');
  const [userId, setUserId] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Voice recording state
  const [recordingCardId, setRecordingCardId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [voiceRecordings, setVoiceRecordings] = useState<Map<string, string>>(new Map());
  const [selectedRegion, setSelectedRegion] = useState<'dublin' | 'cork' | 'galway'>('dublin');
  const [scenarioAnswered, setScenarioAnswered] = useState<Set<string>>(new Set());
  const [pageByView, setPageByView] = useState<Record<CardView, number>>({
    unlocked: 1,
    saved: 1,
    learned: 1
  });

  // Generate or get user ID
  useEffect(() => {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = `learner_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(USER_ID_KEY, id);
    }
    setUserId(id);
  }, []);

  // Load local data
  useEffect(() => {
    setFavorites(readSet(FAVORITES_KEY));
    setLearned(readSet(LEARNED_KEY));
    setUnlocked(readSet(UNLOCKED_KEY));

    const recordings = localStorage.getItem(VOICE_RECORDINGS_KEY);
    if (recordings) {
      try {
        setVoiceRecordings(new Map(JSON.parse(recordings)));
      } catch {
        setVoiceRecordings(new Map());
      }
    }
  }, []);

  // Fetch cards and seasonal cards
  useEffect(() => {
    const load = async () => {
      const [dailyRes, cardsRes, seasonalRes] = await Promise.all([
        axios.get('http://localhost:3001/api/sidequest/daily'),
        axios.get('http://localhost:3001/api/sidequest/cards'),
        axios.get('http://localhost:3001/api/sidequest/seasonal')
      ]);

      const fetchedDaily = normalizeCard(dailyRes.data.card as RawSlangCard);
      const fetchedCards = (cardsRes.data.cards as RawSlangCard[]).map(normalizeCard);
      const fetchedSeasonal = (seasonalRes.data.seasonal as RawSlangCard[]).map(normalizeCard);
      const conversationCards = loadConversationFlashcards();
      const conversationIds = conversationCards.map((card) => card.id);
      const mergedCards = [...fetchedCards];
      const knownPhrases = new Set(mergedCards.map((card) => card.phrase.toLocaleLowerCase()));
      const needsPronunciation = conversationCards.filter(
        (card) => card.pronunciation === 'Use Hear it and repeat phrase-by-phrase.'
      );

      if (needsPronunciation.length > 0) {
        const updateResults = await Promise.allSettled(
          needsPronunciation.map(async (card) => ({
            id: card.id,
            phrase: card.phrase,
            pronunciation: await fetchPhoneticPronunciation(card.phrase)
          }))
        );
        const updates = updateResults
          .filter((result): result is PromiseFulfilledResult<{ id: string; phrase: string; pronunciation: string }> => (
            result.status === 'fulfilled'
          ))
          .map((result) => result.value);
        const pronunciationById = new Map(updates.map((item) => [item.id, item.pronunciation]));

        for (const card of conversationCards) {
          const updatedPronunciation = pronunciationById.get(card.id);
          if (updatedPronunciation) {
            card.pronunciation = updatedPronunciation;
          }
        }

        persistConversationPronunciations(
          updates.map((item) => ({ phrase: item.phrase, pronunciation: item.pronunciation }))
        );
      }

      for (const card of conversationCards) {
        const normalizedPhrase = card.phrase.toLocaleLowerCase();
        if (knownPhrases.has(normalizedPhrase)) {
          continue;
        }
        knownPhrases.add(normalizedPhrase);
        mergedCards.push(card);
      }

      setDailyCard(fetchedDaily);
      setCards(mergedCards);
  setSeasonalCards(fetchedSeasonal);

      setUnlocked(prev => {
        const next = new Set(prev);
        next.add(fetchedDaily.id);
        for (const id of conversationIds) {
          next.add(id);
        }
        writeSet(UNLOCKED_KEY, next);
        return next;
      });

      setFavorites(prev => {
        const next = new Set(prev);
        for (const id of conversationIds) {
          next.add(id);
        }
        writeSet(FAVORITES_KEY, next);
        return next;
      });
    };

    load();
  }, []);

  // Fetch leaderboard
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/sidequest/leaderboard');
        setLeaderboard(res.data.leaderboard || []);
      } catch {
        setLeaderboard([]);
      }
    };

    fetchLeaderboard();
  }, []);

  const unlockedCards = useMemo(() => cards.filter(card => unlocked.has(card.id)), [cards, unlocked]);
  const savedCards = useMemo(() => cards.filter(card => favorites.has(card.id)), [cards, favorites]);
  const learnedCards = useMemo(() => cards.filter(card => learned.has(card.id)), [cards, learned]);

  const visibleCards = useMemo(() => {
    if (cardView === 'saved') {
      return savedCards;
    }

    if (cardView === 'learned') {
      return learnedCards;
    }

    return unlockedCards;
  }, [cardView, savedCards, learnedCards, unlockedCards]);

  const totalPages = Math.max(1, Math.ceil(visibleCards.length / CARDS_PER_PAGE));
  const currentPage = Math.min(pageByView[cardView], totalPages);

  const paginatedVisibleCards = useMemo(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE;
    return visibleCards.slice(start, start + CARDS_PER_PAGE);
  }, [visibleCards, currentPage]);

  useEffect(() => {
    if (pageByView[cardView] > totalPages) {
      setPageByView((prev) => ({
        ...prev,
        [cardView]: totalPages
      }));
    }
  }, [cardView, pageByView, totalPages]);

  const stats = useMemo(() => {
    const unlockedCount = unlocked.size;
    const learnedCount = learned.size;
    const favoriteCount = favorites.size;
    return { unlockedCount, learnedCount, favoriteCount };
  }, [unlocked, learned, favorites]);

  function toggleFavorite(cardId: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      writeSet(FAVORITES_KEY, next);
      return next;
    });
  }

  function updateLeaderboardScore(cardsLearnedCount: number) {
    axios.post('http://localhost:3001/api/sidequest/leaderboard', {
      userId,
      cardsLearned: cardsLearnedCount,
      score: quizScore || 0
    }).catch(err => console.error('Failed to update leaderboard:', err));
  }

  function markLearned(cardId: string) {
    setLearned(prev => {
      if (prev.has(cardId)) {
        return prev;
      }

      const next = new Set(prev);
      next.add(cardId);
      writeSet(LEARNED_KEY, next);
      updateLeaderboardScore(next.size);
      return next;
    });
  }

  function unlearnCard(cardId: string) {
    setLearned(prev => {
      if (!prev.has(cardId)) {
        return prev;
      }

      const next = new Set(prev);
      next.delete(cardId);
      writeSet(LEARNED_KEY, next);
      updateLeaderboardScore(next.size);
      return next;
    });
  }

  function toggleLearned(cardId: string) {
    if (learned.has(cardId)) {
      unlearnCard(cardId);
      return;
    }

    markLearned(cardId);
  }

  function unlockRandomCard() {
    const locked = cards.filter(card => !unlocked.has(card.id));
    if (locked.length === 0) {
      return;
    }

    const random = locked[Math.floor(Math.random() * locked.length)];
    setUnlocked(prev => {
      const next = new Set(prev);
      next.add(random.id);
      writeSet(UNLOCKED_KEY, next);
      return next;
    });
  }

  function startQuiz() {
    if (unlockedCards.length < 3) {
      return;
    }

    const selected = shuffle(unlockedCards).slice(0, 3);
    const questions = selected.map(card => {
      const distractors = shuffle(cards.filter(c => c.id !== card.id)).slice(0, 2).map(c => c.meaning);
      const options = shuffle([card.meaning, ...distractors]);

      return {
        cardId: card.id,
        prompt: `What does "${card.phrase}" mean?`,
        options,
        answer: card.meaning
      };
    });

    setQuiz(questions);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizDone(false);
  }

  function answerQuiz(choice: string) {
    const current = quiz[quizIndex];
    if (!current) {
      return;
    }

    if (choice === current.answer) {
      setQuizScore(prev => prev + 1);
      markLearned(current.cardId);
    }

    const nextIndex = quizIndex + 1;
    if (nextIndex >= quiz.length) {
      setQuizDone(true);
    } else {
      setQuizIndex(nextIndex);
    }
  }

  // Voice recording handler
  async function startVoiceRecording(cardId: string) {
    setRecordingCardId(cardId);
    setIsRecording(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();

        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          setVoiceRecordings(prev => {
            const next = new Map(prev);
            next.set(cardId, base64);
            localStorage.setItem(VOICE_RECORDINGS_KEY, JSON.stringify([...next]));
            return next;
          });
        };

        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setRecordingCardId(null);
      };

      recorder.start();
      setMediaRecorder(recorder);

      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 10000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      setRecordingCardId(null);
    }
  }

  function stopVoiceRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
    }
  }

  function playUserRecording(cardId: string) {
    const base64 = voiceRecordings.get(cardId);
    if (!base64) return;

    const audio = new Audio(`data:audio/webm;base64,${base64}`);
    audio.play().catch(err => console.error('Failed to play recording:', err));
  }

  function answerScenario(cardId: string, optionIndex: number, isCorrect: boolean) {
    setScenarioAnswered(prev => {
      const next = new Set(prev);
      next.add(`${cardId}-${optionIndex}`);
      return next;
    });

    if (isCorrect) {
      markLearned(cardId);
    }
  }

  function goToPreviousPage() {
    setPageByView((prev) => ({
      ...prev,
      [cardView]: Math.max(1, prev[cardView] - 1)
    }));
  }

  function goToNextPage() {
    setPageByView((prev) => ({
      ...prev,
      [cardView]: Math.min(totalPages, prev[cardView] + 1)
    }));
  }

  function switchCardView(nextView: CardView) {
    setCardView(nextView);
  }

  return (
    <section className="sidequest-container">
      <header className="sidequest-header">
        <h1>🍀 Quest Realm: Culture Cards 🍀</h1>
        <p>Collect slang, unlock culture notes, master regional dialects, and complete challenges.</p>
      </header>

      <div className="sidequest-stats">
        <div><strong>{stats.unlockedCount}</strong><span>Unlocked</span></div>
        <div><strong>{stats.learnedCount}</strong><span>Learned</span></div>
        <div><strong>{stats.favoriteCount}</strong><span>Favorites</span></div>
      </div>

      {/* Tab Navigation */}
      <div className="sidequest-tab-nav">
        <button
          className={tabView === 'cards' ? 'active' : ''}
          onClick={() => setTabView('cards')}
        >
          📚 Cards
        </button>
        <button
          className={tabView === 'seasonal' ? 'active' : ''}
          onClick={() => setTabView('seasonal')}
        >
          ✨ Seasonal
        </button>
        <button
          className={tabView === 'leaderboard' ? 'active' : ''}
          onClick={() => setTabView('leaderboard')}
        >
          🏆 Leaderboard
        </button>
      </div>

      {/* CARDS TAB */}
      {tabView === 'cards' && (
        <>
          {dailyCard && (
            <article className="daily-card">
              <h2>☀️ Card of the Day</h2>
              <h3>{dailyCard.phrase}</h3>

              <div className="pronunciation-panel">
                <p className="pronunciation-line">
                  <strong>Say it like:</strong> {dailyCard.pronunciation}
                </p>
                <ul className="pronunciation-breakdown">
                  {dailyCard.wordBreakdown.map((entry) => (
                    <li key={`${dailyCard.id}-${entry.irish}`}>
                      <span className="irish-word">{entry.irish}</span>
                      <span className="sound-like">{entry.soundLike}</span>
                      <small>{entry.tip}</small>
                    </li>
                  ))}
                </ul>
              </div>

              <p><strong>Meaning:</strong> {dailyCard.meaning}</p>
              <p><strong>Use it when:</strong> {dailyCard.whenToUse}</p>
              <p><strong>Example:</strong> {dailyCard.example}</p>
              <p><strong>Culture note:</strong> {dailyCard.cultureNote}</p>
              {dailyCard.historyNote && <p><strong>📖 Historical context:</strong> {dailyCard.historyNote}</p>}

              {/* Regional Variations */}
              {dailyCard.regions && (
                <div className="regional-variations">
                  <h4>🗺️ Regional Variations</h4>
                  <div className="region-tabs">
                    {(['dublin', 'cork', 'galway'] as const).map(region => (
                      <button
                        key={region}
                        className={selectedRegion === region ? 'active' : ''}
                        onClick={() => setSelectedRegion(region)}
                      >
                        {region.charAt(0).toUpperCase() + region.slice(1)}
                      </button>
                    ))}
                  </div>
                  <p className="region-text">{dailyCard.regions[selectedRegion] || '(Not available)'}</p>
                </div>
              )}

              <div className="card-actions">
                <button onClick={() => void speakIrish(dailyCard.phrase)}>🔊 Hear Phrase</button>
                <button
                  onClick={() => {
                    if (recordingCardId === dailyCard.id && isRecording) {
                      stopVoiceRecording();
                    } else {
                      startVoiceRecording(dailyCard.id);
                    }
                  }}
                  className={recordingCardId === dailyCard.id && isRecording ? 'recording' : ''}
                >
                  {recordingCardId === dailyCard.id && isRecording ? '⏹️ Stop Recording' : '🎤 Record Yourself'}
                </button>
                {voiceRecordings.has(dailyCard.id) && (
                  <button onClick={() => playUserRecording(dailyCard.id)}>▶️ Playback</button>
                )}
                <button onClick={() => toggleFavorite(dailyCard.id)}>{favorites.has(dailyCard.id) ? '❤️ Saved' : '🤍 Save'}</button>
                <button onClick={() => toggleLearned(dailyCard.id)}>{learned.has(dailyCard.id) ? '↩️ Unlearn' : '📝 Mark learned'}</button>
              </div>
            </article>
          )}

          <div className="sidequest-controls">
            <button onClick={unlockRandomCard}>🎲 Unlock Random Card</button>
            <button onClick={startQuiz} disabled={unlockedCards.length < 3}>🎯 Start Quiz</button>
          </div>

          <div className="card-view-controls">
            <button
              className={cardView === 'unlocked' ? 'active' : ''}
              onClick={() => switchCardView('unlocked')}
            >
              Unlocked ({stats.unlockedCount})
            </button>
            <button
              className={cardView === 'saved' ? 'active' : ''}
              onClick={() => switchCardView('saved')}
            >
              Saved ({stats.favoriteCount})
            </button>
            <button
              className={cardView === 'learned' ? 'active' : ''}
              onClick={() => switchCardView('learned')}
            >
              Learned ({stats.learnedCount})
            </button>
          </div>

          {visibleCards.length > 0 && (
            <div className="cards-pagination">
              <button onClick={goToPreviousPage} disabled={currentPage === 1}>Previous</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button onClick={goToNextPage} disabled={currentPage === totalPages}>Next</button>
            </div>
          )}

          <section className="unlocked-grid">
            {paginatedVisibleCards.map(card => (
              <article key={card.id} className="slang-card">
                <h3>{card.phrase}</h3>
                <p className="card-pronunciation"><strong>Say:</strong> {card.pronunciation}</p>
                <p>{card.meaning}</p>
                <small>{card.example}</small>

                {/* Regional Variations for Card */}
                {card.regions && (
                  <details className="card-regions">
                    <summary>🗺️ Regional variations ({Object.keys(card.regions).length})</summary>
                    <ul>
                      {Object.entries(card.regions).map(([region, variation]) => (
                        <li key={region}><strong>{region}:</strong> {variation}</li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Scenario Challenge for Card */}
                {card.scenario && (
                  <details className="card-scenario">
                    <summary>🎭 Scenario Challenge</summary>
                    <p><em>{card.scenario.situation}</em></p>
                    <div className="scenario-options">
                      {card.scenario.options.map((option, idx) => {
                        const key = `${card.id}-${idx}`;
                        const answered = scenarioAnswered.has(key);
                        return (
                          <button
                            key={idx}
                            onClick={() => answerScenario(card.id, idx, option.correct)}
                            className={`scenario-btn ${answered ? (option.correct ? 'correct' : 'incorrect') : ''}`}
                            disabled={answered}
                          >
                            {option.text}
                            {answered && <span className="feedback">{option.feedback}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </details>
                )}

                {/* History Note */}
                {card.historyNote && (
                  <details className="card-history">
                    <summary>📖 Historical context</summary>
                    <p>{card.historyNote}</p>
                  </details>
                )}

                <div className="card-actions">
                  <button onClick={() => void speakIrish(card.phrase)}>🔊 Hear</button>
                  <button
                    onClick={() => {
                      if (recordingCardId === card.id && isRecording) {
                        stopVoiceRecording();
                      } else {
                        startVoiceRecording(card.id);
                      }
                    }}
                    className={recordingCardId === card.id && isRecording ? 'recording' : ''}
                  >
                    {recordingCardId === card.id && isRecording ? '⏹️ Stop' : '🎤'}
                  </button>
                  {voiceRecordings.has(card.id) && (
                    <button onClick={() => playUserRecording(card.id)} title="Play your recording">▶️</button>
                  )}
                  <button onClick={() => toggleFavorite(card.id)}>{favorites.has(card.id) ? '❤️' : '🤍'}</button>
                  <button onClick={() => toggleLearned(card.id)}>{learned.has(card.id) ? '↩️' : '📝'}</button>
                </div>
              </article>
            ))}
            {visibleCards.length === 0 && (
              <article className="slang-card empty-collection">
                <h3>No cards yet</h3>
                <p>
                  {cardView === 'saved' && 'Save a card to see it here.'}
                  {cardView === 'learned' && 'Mark a card as learned to see it here.'}
                  {cardView === 'unlocked' && 'Unlock cards to build your collection.'}
                </p>
              </article>
            )}
          </section>

          {quiz.length > 0 && (
            <section className="quiz-panel">
              {!quizDone ? (
                <>
                  <h2>🎯 Mini Quiz</h2>
                  <p><strong>Question {quizIndex + 1}/{quiz.length}:</strong> {quiz[quizIndex]?.prompt}</p>
                  <div className="quiz-options">
                    {quiz[quizIndex]?.options.map(option => (
                      <button key={option} onClick={() => answerQuiz(option)} className="quiz-option">{option}</button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2>🏆 Quiz Complete!</h2>
                  <p>Your score: {quizScore}/{quiz.length} ({Math.round((quizScore / quiz.length) * 100)}%)</p>
                  <button onClick={startQuiz}>Play Again</button>
                </>
              )}
            </section>
          )}
        </>
      )}

      {/* SEASONAL TAB */}
      {tabView === 'seasonal' && (
        <section className="seasonal-section">
          <h2>✨ Seasonal Special Cards ✨</h2>
          {seasonalCards.length > 0 ? (
            <div className="seasonal-grid">
              {seasonalCards.map(card => (
                <article key={card.id} className="seasonal-card">
                  <div className="seasonal-badge">{
                    card.seasonalType === 'brigid' ? '🕯️ St. Brigid' :
                    card.seasonalType === 'patrick' ? '☘️ St. Patrick' :
                    card.seasonalType === 'samhain' ? '🔥 Samhain' :
                    '✨ Special'
                  }</div>
                  <h3>{card.phrase}</h3>
                  <p><strong>Pronunciation:</strong> {card.pronunciation}</p>
                  <p><strong>Meaning:</strong> {card.meaning}</p>
                  <p><em>"{card.example}"</em></p>
                  <p className="culture-note"><strong>📖 {card.cultureNote}</strong></p>
                  {card.historyNote && <p className="history"><strong>History:</strong> {card.historyNote}</p>}
                  <div className="card-actions">
                    <button onClick={() => void speakIrish(card.phrase)}>🔊 Hear</button>
                    <button onClick={() => toggleFavorite(card.id)}>{favorites.has(card.id) ? '❤️ Saved' : '🤍 Save'}</button>
                    <button onClick={() => toggleLearned(card.id)}>{learned.has(card.id) ? '↩️ Unlearn' : '📝 Mark Learned'}</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-seasonal">
              <p>🌍 No seasonal cards are active right now. Check back on special dates!</p>
              <ul>
                <li>🕯️ <strong>St. Brigid's Day:</strong> February 1</li>
                <li>☘️ <strong>St. Patrick's Day:</strong> March 17</li>
                <li>🔥 <strong>Samhain:</strong> November 1</li>
              </ul>
            </div>
          )}
        </section>
      )}

      {/* LEADERBOARD TAB */}
      {tabView === 'leaderboard' && (
        <section className="leaderboard-section">
          <h2>🏆 Leaderboard 🏆</h2>
          <div className="leaderboard-user-stats">
            <p>Your ID: <code>{userId}</code></p>
            <p>Cards Learned: <strong>{stats.learnedCount}</strong></p>
          </div>
          {leaderboard.length > 0 ? (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>🥇 Rank</th>
                  <th>Learner</th>
                  <th>📚 Cards Learned</th>
                  <th>🎯 Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => {
                  const isCurrentUser = entry.userId === userId;
                  return (
                    <tr key={idx} className={isCurrentUser ? 'current-user' : ''}>
                      <td className="rank">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </td>
                      <td>{entry.userId}{isCurrentUser && ' (you)'}</td>
                      <td className="cards-learned">{entry.cardsLearned}</td>
                      <td className="score">{entry.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-leaderboard">
              <p>🌍 No learners on the leaderboard yet. Be the first to join!</p>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
