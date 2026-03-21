import { useMemo, useState } from 'react';

type DrinkType = 'pint' | 'stout' | 'water';
type TableId = 't1' | 't2' | 't3' | 't4';

type Prompt = {
  id: string;
  customerName: string;
  customerLine: string;
  hintTranslation: string;
  barmaidReply: string;
  expectedDrink: DrinkType;
};

type TableOrder = {
  prompt: Prompt;
  hintUsed: boolean;
  matched: boolean;
  responseOptions: string[];
};

type TableLayout = {
  id: TableId;
  label: string;
  x: number;
  y: number;
};

const PROMPTS: Prompt[] = [
  { id: 'p1', customerName: 'Aoife', customerLine: 'Can I get a pint, le do thoil?', hintTranslation: 'le do thoil = please', barmaidReply: 'Seo duit do phionta.', expectedDrink: 'pint' },
  { id: 'p2', customerName: 'Seán', customerLine: 'Just water please, uisce dom.', hintTranslation: 'uisce = water', barmaidReply: 'Seo duit uisce fuar.', expectedDrink: 'water' },
  { id: 'p3', customerName: 'Niamh', customerLine: 'A stout, mas e do thoil e.', hintTranslation: 'mas e do thoil e = if you please', barmaidReply: 'Seo duit stoute deas.', expectedDrink: 'stout' },
  { id: 'p4', customerName: 'Tom', customerLine: 'Pint anois, please.', hintTranslation: 'anois = now', barmaidReply: 'Ceart go leor, seo do phionta.', expectedDrink: 'pint' },
  { id: 'p5', customerName: 'Brid', customerLine: 'Im driving. Uisce, please.', hintTranslation: 'uisce = water', barmaidReply: 'Seo duit uisce, slainte!', expectedDrink: 'water' },
  { id: 'p6', customerName: 'Cian', customerLine: 'Stout dom, go tapa!', hintTranslation: 'go tapa = quickly', barmaidReply: 'Stoute duit, go tapa indeed.', expectedDrink: 'stout' }
];

const TABLES: TableLayout[] = [
  { id: 't1', label: 'Table 1', x: 18, y: 26 },
  { id: 't2', label: 'Table 2', x: 44, y: 18 },
  { id: 't3', label: 'Table 3', x: 69, y: 30 },
  { id: 't4', label: 'Table 4', x: 56, y: 53 }
];

const SPRITE_SOURCES = ['/irish-girl.gif', '/irish-girl.png', '/irish-girl.webp'];

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
  utterance.rate = 0.96;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function buildOptions(prompt: Prompt): string[] {
  const distractors = shuffle(PROMPTS.filter((item) => item.id !== prompt.id).map((item) => item.barmaidReply)).slice(0, 2);
  return shuffle([prompt.barmaidReply, ...distractors]);
}

export default function PintDashQuest() {
  const [promptDeck, setPromptDeck] = useState<Prompt[]>(shuffle(PROMPTS));
  const [deckIndex, setDeckIndex] = useState(0);
  const [ordersByTable, setOrdersByTable] = useState<Record<TableId, TableOrder | null>>({ t1: null, t2: null, t3: null, t4: null });
  const [selectedTable, setSelectedTable] = useState<TableId>('t1');
  const [girlPos, setGirlPos] = useState<{ x: number; y: number }>({ x: 7, y: 70 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 8, y: 72 });
  const [score, setScore] = useState(0);
  const [servedCount, setServedCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [spriteSrcIndex, setSpriteSrcIndex] = useState(0);

  const selectedOrder = ordersByTable[selectedTable];

  const accuracy = useMemo(() => {
    const attempts = servedCount + missCount;
    if (attempts === 0) {
      return 0;
    }
    return Math.round((servedCount / attempts) * 100);
  }, [servedCount, missCount]);

  function assignOrder(tableId: TableId) {
    setOrdersByTable((prev) => {
      if (prev[tableId]) {
        return prev;
      }

      const nextPrompt = promptDeck[deckIndex] || promptDeck[0];
      if (!nextPrompt) {
        return prev;
      }

      setDeckIndex((idx) => {
        const next = idx + 1;
        return next >= promptDeck.length ? 0 : next;
      });

      return {
        ...prev,
        [tableId]: {
          prompt: nextPrompt,
          hintUsed: false,
          matched: false,
          responseOptions: buildOptions(nextPrompt)
        }
      };
    });
  }

  function startShift() {
    const deck = shuffle(PROMPTS);
    const [a, b, c, d] = [deck[0], deck[1], deck[2], deck[3]];
    setPromptDeck(deck);
    setDeckIndex(4 % deck.length);
    setOrdersByTable({
      t1: a ? { prompt: a, hintUsed: false, matched: false, responseOptions: buildOptions(a) } : null,
      t2: b ? { prompt: b, hintUsed: false, matched: false, responseOptions: buildOptions(b) } : null,
      t3: c ? { prompt: c, hintUsed: false, matched: false, responseOptions: buildOptions(c) } : null,
      t4: d ? { prompt: d, hintUsed: false, matched: false, responseOptions: buildOptions(d) } : null
    });
    setScore(0);
    setServedCount(0);
    setMissCount(0);
    setHintCount(0);
    setSelectedTable('t1');
    setGirlPos({ x: 7, y: 70 });
  }

  function moveToTable(table: TableLayout) {
    setSelectedTable(table.id);
    setGirlPos({ x: table.x, y: table.y + 8 });
    assignOrder(table.id);
  }

  function revealHint(tableId: TableId) {
    setOrdersByTable((prev) => {
      const order = prev[tableId];
      if (!order || order.hintUsed) {
        return prev;
      }

      setHintCount((count) => count + 1);
      setScore((value) => Math.max(0, value - 2));

      return {
        ...prev,
        [tableId]: {
          ...order,
          hintUsed: true
        }
      };
    });
  }

  function matchReply(tableId: TableId, choice: string) {
    setOrdersByTable((prev) => {
      const order = prev[tableId];
      if (!order || order.matched) {
        return prev;
      }

      if (choice === order.prompt.barmaidReply) {
        setScore((value) => value + 20);
        return {
          ...prev,
          [tableId]: {
            ...order,
            matched: true
          }
        };
      }

      setMissCount((count) => count + 1);
      setScore((value) => Math.max(0, value - 6));
      return prev;
    });
  }

  function serveSelected(drink: DrinkType) {
    const order = ordersByTable[selectedTable];
    if (!order) {
      return;
    }

    if (!order.matched) {
      setMissCount((count) => count + 1);
      setScore((value) => Math.max(0, value - 8));
      return;
    }

    if (drink !== order.prompt.expectedDrink) {
      setMissCount((count) => count + 1);
      setScore((value) => Math.max(0, value - 10));
      return;
    }

    setServedCount((count) => count + 1);
    setScore((value) => value + 35);
    setOrdersByTable((prev) => ({ ...prev, [selectedTable]: null }));

    window.setTimeout(() => assignOrder(selectedTable), 350);
  }

  return (
    <section className="pint-dash-container">
      <header className="pint-dash-header">
        <h1>Pint Dash: Emerald Bar Shift</h1>
        <p>Click a table with your mouse to move the barmaid. Match the Irish line, then serve the correct drink.</p>
      </header>

      <div className="pint-dash-stats">
        <div><strong>{score}</strong><span>Score</span></div>
        <div><strong>{servedCount}</strong><span>Served</span></div>
        <div><strong>{accuracy}%</strong><span>Accuracy</span></div>
        <div><strong>{hintCount}</strong><span>Hints</span></div>
      </div>

      <div className="pint-dash-controls">
        <button onClick={startShift}>Start New Shift</button>
      </div>

      <section
        className="irish-bar-scene"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          setCursorPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
        }}
      >
        <div className="bar-counter" aria-hidden="true" />
        <div className="bar-celtic-glow" aria-hidden="true" />
        <div className="cursor-orb" style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }} aria-hidden="true" />

        {TABLES.map((table) => {
          const order = ordersByTable[table.id];
          return (
            <button
              key={table.id}
              className={`bar-table ${selectedTable === table.id ? 'selected' : ''}`}
              style={{ left: `${table.x}%`, top: `${table.y}%` }}
              onClick={() => moveToTable(table)}
            >
              <span>{table.label}</span>
              <small>{order ? order.prompt.customerName : 'Tap for customer'}</small>
            </button>
          );
        })}

        <div className="barmaid-sprite" style={{ left: `${girlPos.x}%`, top: `${girlPos.y}%` }}>
          {spriteSrcIndex < SPRITE_SOURCES.length ? (
            <img
              src={SPRITE_SOURCES[spriteSrcIndex]}
              alt="Irish barmaid"
              onError={() => setSpriteSrcIndex((prev) => prev + 1)}
            />
          ) : (
            <div className="sprite-fallback" aria-label="Irish barmaid">
              <span>🍀</span>
              <small>Add irish-girl.gif to frontend/public</small>
            </div>
          )}
        </div>
      </section>

      <section className="pint-learning-panel">
        <h2>{selectedOrder ? `${selectedOrder.prompt.customerName} at ${selectedTable.toUpperCase()}` : 'Select a table'}</h2>

        {selectedOrder ? (
          <>
            <p className="customer-line">{selectedOrder.prompt.customerLine}</p>

            <div className="customer-hint">
              <button onClick={() => revealHint(selectedTable)} disabled={selectedOrder.hintUsed}>
                {selectedOrder.hintUsed ? 'Hint Used' : 'Hint'}
              </button>
              {selectedOrder.hintUsed && <span>{selectedOrder.prompt.hintTranslation}</span>}
            </div>

            <div className="barmaid-reply-block">
              <p>Choose the Irish line the barmaid should say:</p>
              <div className="reply-options">
                {selectedOrder.responseOptions.map((option) => (
                  <button
                    key={`${selectedOrder.prompt.id}-${option}`}
                    onClick={() => matchReply(selectedTable, option)}
                    disabled={selectedOrder.matched}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button className="hear-reply" onClick={() => speakIrish(selectedOrder.prompt.barmaidReply)}>
                Hear Correct Reply
              </button>
            </div>

            <div className="serve-row">
              <span>{selectedOrder.matched ? 'Great, now serve the drink.' : 'Match the Irish line first.'}</span>
              <div>
                <button onClick={() => serveSelected('pint')}>Serve Pint</button>
                <button onClick={() => serveSelected('stout')}>Serve Stout</button>
                <button onClick={() => serveSelected('water')}>Serve Water</button>
              </div>
            </div>
          </>
        ) : (
          <p className="customer-line">No active order here yet. Click Start New Shift or tap another table.</p>
        )}
      </section>
    </section>
  );
}
