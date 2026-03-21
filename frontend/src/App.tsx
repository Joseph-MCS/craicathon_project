import { useState } from 'react';
import ConversationInterface from './components/ConversationInterface';
import IrishSideQuest from './components/IrishSideQuest';

type View =
  | 'landing'
  | 'core'
  | 'quests-hub'
  | 'quest-cards'
  | 'quest-phrase-rescue'
  | 'quest-story-trail';

function App() {
  const [view, setView] = useState<View>('landing');

  if (view === 'landing') {
    return (
      <div className="App">
        <section className="landing-page">
          <div className="landing-aura" aria-hidden="true" />
          <p className="landing-kicker">Failte go Craicathon</p>
          <h1>Craicathon Language Hub</h1>
          <p className="landing-copy">
            One journey, two paths. Enter the core conversation flow or branch
            into the Irish Side Quest for slang, stories, and culture.
          </p>

          <div className="landing-tags" aria-hidden="true">
            <span>Comhra</span>
            <span>Cultur</span>
            <span>Craic</span>
          </div>

          <div className="landing-actions">
            <button className="nav-card" onClick={() => setView('core')}>
              <strong>Go to Core Learning</strong>
              <span>Main chat and feedback loop</span>
            </button>
            <button className="nav-card" onClick={() => setView('quests-hub')}>
              <strong>Go to Quest Realm</strong>
              <span>All side quests in one place</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (view === 'quests-hub') {
    return (
      <div className="App">
        <div className="mode-switch single-back">
          <button onClick={() => setView('landing')}>Back to Landing</button>
        </div>

        <section className="quests-hub">
          <h1>Quest Realm</h1>
          <p>Pick a side quest and jump in.</p>

          <div className="quests-grid">
            <button className="quest-button" onClick={() => setView('quest-cards')}>
              <strong>Slang and Culture Cards</strong>
              <span>Collect cards, unlock notes, and run mini quizzes.</span>
            </button>

            <button className="quest-button" onClick={() => setView('quest-phrase-rescue')}>
              <strong>Phrase Rescue</strong>
              <span>Repair broken Irish sentences against the clock.</span>
            </button>

            <button className="quest-button" onClick={() => setView('quest-story-trail')}>
              <strong>Story Trail</strong>
              <span>Choose responses and shape a short Irish adventure.</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="mode-switch single-back">
        {view !== 'core' && (
          <button onClick={() => setView('quests-hub')}>Back to Quest Realm</button>
        )}
        <button onClick={() => setView('landing')}>Back to Landing</button>
      </div>

      {view === 'core' && <ConversationInterface />}

      {view === 'quest-cards' && <IrishSideQuest />}

      {view === 'quest-phrase-rescue' && (
        <section className="quest-placeholder">
          <h1>Phrase Rescue</h1>
          <p>
            This quest is queued next. You will fix grammar and phrase order in
            short Irish prompts for points.
          </p>
        </section>
      )}

      {view === 'quest-story-trail' && (
        <section className="quest-placeholder">
          <h1>Story Trail</h1>
          <p>
            This quest is queued next. You will choose Irish responses that
            unlock different story endings.
          </p>
        </section>
      )}
    </div>
  );
}

export default App;
