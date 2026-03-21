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
};

type RawSlangCard = {
  id: string;
  phrase: string;
  pronunciation?: string;
  meaning: string;
  whenToUse: string;
  example: string;
  cultureNote: string;
  wordBreakdown?: Array<{
    irish: string;
    soundLike: string;
    tip: string;
  }>;
};

type QuizQuestion = {
  cardId: string;
  prompt: string;
  options: string[];
  answer: string;
};

type CardView = 'unlocked' | 'saved' | 'learned';

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
  const response = await fetch('http://localhost:3001/api/pronunciation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
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

function speakIrish(text: string) {
  if (!('speechSynthesis' in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ga-IE';
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function normalizeCard(raw: RawSlangCard): SlangCard {
  const defaultBreakdown = raw.phrase
    .replace(/[!?.,]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({
      irish: word,
      soundLike: '(listen)',
      tip: 'Tap Hear it and repeat slowly.'
    }));

  return {
    ...raw,
    pronunciation: raw.pronunciation ?? 'Use Hear it and repeat phrase-by-phrase.',
    wordBreakdown: raw.wordBreakdown && raw.wordBreakdown.length > 0
      ? raw.wordBreakdown
      : defaultBreakdown
  };
}

export default function IrishSideQuest() {
  const [cards, setCards] = useState<SlangCard[]>([]);
  const [dailyCard, setDailyCard] = useState<SlangCard | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [learned, setLearned] = useState<Set<string>>(new Set());
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [cardView, setCardView] = useState<CardView>('unlocked');

  useEffect(() => {
    setFavorites(readSet(FAVORITES_KEY));
    setLearned(readSet(LEARNED_KEY));
    setUnlocked(readSet(UNLOCKED_KEY));
  }, []);

  useEffect(() => {
    const load = async () => {
      const [dailyRes, cardsRes] = await Promise.all([
        axios.get('http://localhost:3001/api/sidequest/daily'),
        axios.get('http://localhost:3001/api/sidequest/cards')
      ]);

      const fetchedDaily = normalizeCard(dailyRes.data.card as RawSlangCard);
      const fetchedCards = (cardsRes.data.cards as RawSlangCard[]).map(normalizeCard);
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

    load().catch(error => {
      console.error('Failed to load side quest cards', error);
    });
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

  function markLearned(cardId: string) {
    setLearned(prev => {
      const next = new Set(prev);
      next.add(cardId);
      writeSet(LEARNED_KEY, next);
      return next;
    });
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

  return (
    <section className="sidequest-container">
      <header className="sidequest-header">
        <h1>Quest Realm: Culture Cards</h1>
        <p>Collect slang, unlock culture notes, and complete a mini challenge.</p>
      </header>

      <div className="sidequest-stats">
        <div><strong>{stats.unlockedCount}</strong><span>Unlocked</span></div>
        <div><strong>{stats.learnedCount}</strong><span>Learned</span></div>
        <div><strong>{stats.favoriteCount}</strong><span>Favorites</span></div>
      </div>

      {dailyCard && (
        <article className="daily-card">
          <h2>Card of the Day</h2>
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
          <div className="card-actions">
            <button onClick={() => speakIrish(dailyCard.phrase)}>Hear it</button>
            <button onClick={() => toggleFavorite(dailyCard.id)}>{favorites.has(dailyCard.id) ? 'Unsave' : 'Save'}</button>
            <button onClick={() => markLearned(dailyCard.id)}>Mark learned</button>
          </div>
        </article>
      )}

      <div className="sidequest-controls">
        <button onClick={unlockRandomCard}>Unlock random card</button>
        <button onClick={startQuiz} disabled={unlockedCards.length < 3}>Start mini quiz</button>
      </div>

      <div className="card-view-controls">
        <button
          className={cardView === 'unlocked' ? 'active' : ''}
          onClick={() => setCardView('unlocked')}
        >
          Unlocked Cards
        </button>
        <button
          className={cardView === 'saved' ? 'active' : ''}
          onClick={() => setCardView('saved')}
        >
          Saved Cards
        </button>
        <button
          className={cardView === 'learned' ? 'active' : ''}
          onClick={() => setCardView('learned')}
        >
          Learned Cards
        </button>
      </div>

      <section className="unlocked-grid">
        {visibleCards.map(card => (
          <article key={card.id} className="slang-card">
            <h3>{card.phrase}</h3>
            <p className="card-pronunciation"><strong>Say:</strong> {card.pronunciation}</p>
            <p>{card.meaning}</p>
            <small>{card.example}</small>
            <div className="card-actions">
              <button onClick={() => speakIrish(card.phrase)}>Hear</button>
              <button onClick={() => toggleFavorite(card.id)}>{favorites.has(card.id) ? 'Saved' : 'Save'}</button>
              <button onClick={() => markLearned(card.id)}>{learned.has(card.id) ? 'Learned' : 'Mark learned'}</button>
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
              <h2>Mini Quiz</h2>
              <p>{quiz[quizIndex]?.prompt}</p>
              <div className="quiz-options">
                {quiz[quizIndex]?.options.map(option => (
                  <button key={option} onClick={() => answerQuiz(option)}>{option}</button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2>Quiz complete</h2>
              <p>Your score: {quizScore}/{quiz.length}</p>
              <button onClick={startQuiz}>Play again</button>
            </>
          )}
        </section>
      )}
    </section>
  );
}
