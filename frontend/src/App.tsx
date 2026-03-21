import { useState } from 'react';
import ConversationInterface from './components/ConversationInterface';
import IrishSideQuest from './components/IrishSideQuest';
import PintDashQuest from './components/PintDashQuest';

type View =
  | 'landing'
  | 'core'
  | 'quests-hub'
  | 'quest-cards'
  | 'quest-pint-dash';

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

            <button className="quest-button" onClick={() => setView('quest-pint-dash')}>
              <strong>Pint Dash</strong>
              <span>Run an Irish pub shift with hints, matching, and quick serving.</span>
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

      {view === 'quest-pint-dash' && <PintDashQuest />}
    </div>
  );
}

export default App;
