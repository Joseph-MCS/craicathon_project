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

      setDailyCard(fetchedDaily);
      setCards(fetchedCards);

      setUnlocked(prev => {
        const next = new Set(prev);
        next.add(fetchedDaily.id);
        writeSet(UNLOCKED_KEY, next);
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
