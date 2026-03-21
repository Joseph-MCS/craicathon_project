import { useEffect, useMemo, useRef, useState } from 'react';

type DrinkType = 'pint' | 'stout' | 'water';
type TableId = 't1' | 't2' | 't3' | 't4';

type Prompt = {
  id: string;
  customerName: string;
  customerLine: string;
  hintCombined: string;
  barmaidReply: string;
  thankYouIrish: string;
  expectedDrink: DrinkType;
};

type TableOrder = {
  prompt: Prompt;
  hintUsed: boolean;
  matched: boolean;
  responseOptions: string[];
  phase: 'settling' | 'ordering' | 'matched' | 'served';
};

type TableLayout = {
  id: TableId;
  label: string;
  x: number;
  y: number;
};

const PROMPTS: Prompt[] = [
  { id: 'p1', customerName: 'Aoife', customerLine: 'Can I get a pint, le do thoil?', hintCombined: 'pionta = pint | le do thoil = please', barmaidReply: 'Seo duit do phionta.', thankYouIrish: 'Go raibh maith agat!', expectedDrink: 'pint' },
  { id: 'p2', customerName: 'Seán', customerLine: 'Just water please, uisce dom.', hintCombined: 'uisce = water | dom = for me', barmaidReply: 'Seo duit uisce fuar.', thankYouIrish: 'Mile buiochas!', expectedDrink: 'water' },
  { id: 'p3', customerName: 'Niamh', customerLine: 'A stout, mas e do thoil e.', hintCombined: 'stoute = stout | mas e do thoil e = if you please', barmaidReply: 'Seo duit stoute deas.', thankYouIrish: 'Go hiontach, go raibh maith agat!', expectedDrink: 'stout' },
  { id: 'p4', customerName: 'Tom', customerLine: 'Pint anois, please.', hintCombined: 'anois = now | pionta = pint', barmaidReply: 'Ceart go leor, seo do phionta.', thankYouIrish: 'Go raibh maith agat, a chara!', expectedDrink: 'pint' },
  { id: 'p5', customerName: 'Brid', customerLine: 'Im driving. Uisce, please.', hintCombined: 'uisce = water | ag tiomaint = driving', barmaidReply: 'Seo duit uisce, slainte!', thankYouIrish: 'Mile buiochas, slan!', expectedDrink: 'water' },
  { id: 'p6', customerName: 'Cian', customerLine: 'Stout dom, go tapa!', hintCombined: 'go tapa = quickly | dom = for me', barmaidReply: 'Stoute duit, go tapa indeed.', thankYouIrish: 'Go raimh maith agat!', expectedDrink: 'stout' }
];

const TABLES: TableLayout[] = [
  { id: 't1', label: 'Table 1', x: 18, y: 26 },
  { id: 't2', label: 'Table 2', x: 44, y: 18 },
  { id: 't3', label: 'Table 3', x: 69, y: 30 },
  { id: 't4', label: 'Table 4', x: 56, y: 53 }
];

const SPRITE_SOURCES = ['/irish-girl.gif', '/irish-girl.png', '/irish-girl.webp'];
const CUSTOMER_SOURCES = ['/irish-customer.gif'];
const BAR_TAP_POINT = { x: 49, y: 74 };

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
  const [waitingQueue, setWaitingQueue] = useState<Prompt[]>([]);
  const [ordersByTable, setOrdersByTable] = useState<Record<TableId, TableOrder | null>>({ t1: null, t2: null, t3: null, t4: null });
  const [selectedQueueIndex, setSelectedQueueIndex] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableId>('t1');
  const [girlPos, setGirlPos] = useState<{ x: number; y: number }>({ x: 7, y: 73 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 8, y: 72 });
  const [carriedDrink, setCarriedDrink] = useState<DrinkType | null>(null);
  const [score, setScore] = useState(0);
  const [servedCount, setServedCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [spriteSrcIndex, setSpriteSrcIndex] = useState(0);
  const [customerSpriteIndex, setCustomerSpriteIndex] = useState(0);
  const [statusText, setStatusText] = useState('Select a waiting customer, then click a free table to seat them.');
  const settlingTimers = useRef<Record<TableId, number | null>>({ t1: null, t2: null, t3: null, t4: null });

  const selectedOrder = ordersByTable[selectedTable];

  const accuracy = useMemo(() => {
    const attempts = servedCount + missCount;
    if (attempts === 0) {
      return 0;
    }
    return Math.round((servedCount / attempts) * 100);
  }, [servedCount, missCount]);

  useEffect(() => {
    return () => {
      (Object.keys(settlingTimers.current) as TableId[]).forEach((tableId) => {
        const timer = settlingTimers.current[tableId];
        if (timer) {
          window.clearTimeout(timer);
        }
      });
    };
  }, []);

  useEffect(() => {
    startShift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function seatSelectedCustomer(tableId: TableId) {
    if (selectedQueueIndex === null) {
      setStatusText('Pick a customer from the queue first.');
      return;
    }

    let nextPrompt: Prompt | null = null;

    setWaitingQueue((prev) => {
      if (prev.length === 0 || selectedQueueIndex < 0 || selectedQueueIndex >= prev.length) {
        return prev;
      }

      nextPrompt = prev[selectedQueueIndex];
      return prev.filter((_, idx) => idx !== selectedQueueIndex);
    });

    if (!nextPrompt) {
      setStatusText('No customer selected.');
      return;
    }

    setSelectedQueueIndex(null);
    setStatusText(`${(nextPrompt as Prompt).customerName} seated at ${tableId.toUpperCase()}. Waiting for order...`);

    setOrdersByTable((prev) => ({
      ...prev,
      [tableId]: {
        prompt: nextPrompt as Prompt,
        hintUsed: false,
        matched: false,
        responseOptions: buildOptions(nextPrompt as Prompt),
        phase: 'settling'
      }
    }));

    settlingTimers.current[tableId] = window.setTimeout(() => {
      setOrdersByTable((prev) => {
        const current = prev[tableId];
        if (!current || current.phase !== 'settling') {
          return prev;
        }

        return {
          ...prev,
          [tableId]: {
            ...current,
            phase: 'ordering'
          }
        };
      });
      setStatusText(`${(nextPrompt as Prompt).customerName} is ready to order.`);
    }, 5000);
  }

  function startShift() {
    const deck = shuffle([...PROMPTS, ...PROMPTS]);
    setWaitingQueue(deck);
    setOrdersByTable({ t1: null, t2: null, t3: null, t4: null });
    setScore(0);
    setServedCount(0);
    setMissCount(0);
    setHintCount(0);
    setCarriedDrink(null);
    setSelectedQueueIndex(null);
    setSelectedTable('t1');
    setGirlPos({ x: 7, y: 73 });
    setStatusText('Shift started. Click a waiting customer, then click a free table.');

    (Object.keys(settlingTimers.current) as TableId[]).forEach((tableId) => {
      const timer = settlingTimers.current[tableId];
      if (timer) {
        window.clearTimeout(timer);
      }
      settlingTimers.current[tableId] = null;
    });
  }

  function moveToTable(table: TableLayout) {
    setSelectedTable(table.id);
    setGirlPos({ x: table.x, y: table.y + 8 });

    if (ordersByTable[table.id]) {
      return;
    }

    if (waitingQueue.length === 0) {
      setStatusText('No customers waiting in queue.');
      return;
    }

    seatSelectedCustomer(table.id);
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

      if (order.phase !== 'ordering' && order.phase !== 'matched') {
        return prev;
      }

      if (choice === order.prompt.barmaidReply) {
        setScore((value) => value + 20);
        return {
          ...prev,
          [tableId]: {
            ...order,
            matched: true,
            phase: 'matched'
          }
        };
      }

      setMissCount((count) => count + 1);
      setScore((value) => Math.max(0, value - 6));
      return prev;
    });
  }

  function pourAtBar() {
    setGirlPos({ x: BAR_TAP_POINT.x, y: BAR_TAP_POINT.y });

    const order = ordersByTable[selectedTable];
    if (!order || order.phase !== 'matched') {
      return;
    }

    setCarriedDrink(order.prompt.expectedDrink);
    setScore((value) => value + 4);
  }

  function serveSelected(drink: DrinkType) {
    const order = ordersByTable[selectedTable];
    if (!order) {
      return;
    }

    if (!order.matched || order.phase !== 'matched') {
      setMissCount((count) => count + 1);
      setScore((value) => Math.max(0, value - 8));
      return;
    }

    if (!carriedDrink) {
      setMissCount((count) => count + 1);
      setScore((value) => Math.max(0, value - 5));
      return;
    }

    if (carriedDrink !== drink) {
      setMissCount((count) => count + 1);
      setScore((value) => Math.max(0, value - 6));
      return;
    }

    if (drink !== order.prompt.expectedDrink) {
      setMissCount((count) => count + 1);
      setScore((value) => Math.max(0, value - 10));
      return;
    }

    setServedCount((count) => count + 1);
    setScore((value) => value + 35);
    setCarriedDrink(null);
    setStatusText(`${order.prompt.thankYouIrish} ${order.prompt.customerName} is leaving.`);
    setOrdersByTable((prev) => ({
      ...prev,
      [selectedTable]: {
        ...order,
        phase: 'served'
      }
    }));

    window.setTimeout(() => {
      setOrdersByTable((prev) => ({ ...prev, [selectedTable]: null }));
    }, 1800);
  }

  function tableBubbleText(order: TableOrder): string {
    if (order.phase === 'settling') {
      return 'Settling in...';
    }

    if (order.phase === 'served') {
      return order.prompt.thankYouIrish;
    }

    return order.prompt.customerLine;
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

      <article className="pub-queue-panel">
        <h2>Incoming Customers</h2>
        <p>
          Queue: <strong>{waitingQueue.length}</strong> waiting. Click a customer, then click a free table.
        </p>
        <p>{statusText}</p>
        <div className="queue-lane">
          {waitingQueue.slice(0, 8).map((customer, idx) => (
            <button
              key={`${customer.id}-${idx}`}
              className={`queue-customer ${selectedQueueIndex === idx ? 'selected' : ''}`}
              onClick={() => {
                setSelectedQueueIndex(idx);
                setStatusText(`${customer.customerName} selected. Click a free table to seat.`);
              }}
            >
              {customerSpriteIndex < CUSTOMER_SOURCES.length ? (
                <img src={CUSTOMER_SOURCES[customerSpriteIndex]} alt="Waiting Irish customer" />
              ) : (
                <div className="customer-fallback">🙂</div>
              )}
              <span>{customer.customerName}</span>
            </button>
          ))}
          {waitingQueue.length === 0 && <p className="queue-empty">No one waiting right now.</p>}
        </div>
      </article>

      <div className="pint-dash-controls">
        <button onClick={startShift}>Start New Shift</button>
        <button onClick={pourAtBar} disabled={!selectedOrder || selectedOrder.phase !== 'matched'}>
          Pour At Bar Counter
        </button>
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
        <button className="bar-pour-zone" onClick={pourAtBar} style={{ left: `${BAR_TAP_POINT.x}%`, top: `${BAR_TAP_POINT.y}%` }}>
          {carriedDrink ? `Ready: ${carriedDrink}` : 'Tap / Pour Zone'}
        </button>

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
              <small>{order ? order.prompt.customerName : waitingQueue.length > 0 ? 'Click to seat next' : 'Free table'}</small>
            </button>
          );
        })}

        {TABLES.map((table) => {
          const order = ordersByTable[table.id];
          if (!order) {
            return null;
          }

          return (
            <div key={`${table.id}-customer`} className="table-customer" style={{ left: `${table.x}%`, top: `${table.y + 11}%` }}>
              {customerSpriteIndex < CUSTOMER_SOURCES.length ? (
                <img
                  src={CUSTOMER_SOURCES[customerSpriteIndex]}
                  alt="Irish pub customer"
                  onError={() => setCustomerSpriteIndex((prev) => prev + 1)}
                />
              ) : (
                <div className="customer-fallback">🙂</div>
              )}
              <div className="customer-bubble">{tableBubbleText(order)}</div>
            </div>
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
              {selectedOrder.hintUsed && <span>{selectedOrder.prompt.hintCombined}</span>}
            </div>

            <div className="barmaid-reply-block">
              <p>Choose the Irish line the barmaid should say:</p>
              <div className="reply-options">
                {selectedOrder.responseOptions.map((option) => (
                  <button
                    key={`${selectedOrder.prompt.id}-${option}`}
                    onClick={() => matchReply(selectedTable, option)}
                    disabled={selectedOrder.phase === 'served'}
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
              <span>
                {selectedOrder.phase === 'served' && 'Customer thanked you and is leaving...'}
                {selectedOrder.phase !== 'served' && selectedOrder.matched && !carriedDrink && 'Correct. Now pour at the bar zone first.'}
                {selectedOrder.phase !== 'served' && selectedOrder.matched && carriedDrink && 'Great. Bring that drink to this table now.'}
                {!selectedOrder.matched && 'Match the Irish line first.'}
              </span>
              <div>
                <button onClick={() => serveSelected('pint')} disabled={selectedOrder.phase === 'served'}>Serve Pint</button>
                <button onClick={() => serveSelected('stout')} disabled={selectedOrder.phase === 'served'}>Serve Stout</button>
                <button onClick={() => serveSelected('water')} disabled={selectedOrder.phase === 'served'}>Serve Water</button>
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
