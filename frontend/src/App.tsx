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
          <p className="landing-kicker">Fáilte go Craicathon</p>
          <h1>Labhair Linn</h1>
          <p className="landing-copy">
            Cleacht do chuid Gaeilge i spás glan, geal, agus lán de chraic.
            Téigh isteach sa chomhrá beo, nó bog isteach sna cluichí taobh le
            frásaí, cultúr, agus scéalta beaga.
          </p>

          <div className="landing-tags" aria-hidden="true">
            <span>Comhrá</span>
            <span>Guth</span>
            <span>Focail</span>
            <span>Cultúr</span>
            <span>Craic</span>
          </div>

          <div className="landing-actions">
            <button className="nav-card" onClick={() => setView('core')}>
              <strong>Comhrá Beo</strong>
              <span>Mic, tras-scríobh, freagra, agus guth ar ais</span>
            </button>
            <button className="nav-card" onClick={() => setView('quests-hub')}>
              <strong>Eachtraí Gaeilge</strong>
              <span>Cártaí, cultúr, agus cluichí beaga in aon áit amháin</span>
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
          <button onClick={() => setView('landing')}>Ar ais abhaile</button>
        </div>

        <section className="quests-hub">
          <h1>Eachtraí Gaeilge</h1>
          <p>Pioc cluiche agus lean ort ag foghlaim.</p>

          <div className="quests-grid">
            <button className="quest-button" onClick={() => setView('quest-cards')}>
              <strong>Cártaí agus Cultúr</strong>
              <span>Bailigh cártaí, oscail nótaí, agus déan tráth na gceist beag.</span>
            </button>

            <button className="quest-button" onClick={() => setView('quest-phrase-rescue')}>
              <strong>Tarrtháil Frásaí</strong>
              <span>Deisigh abairtí briste Gaeilge sula ritheann an t-am amach.</span>
            </button>

            <button className="quest-button" onClick={() => setView('quest-story-trail')}>
              <strong>Scéalta Beaga</strong>
              <span>Roghnaigh freagraí agus múnlaigh eachtra ghearr i nGaeilge.</span>
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
          <button onClick={() => setView('quests-hub')}>Ar ais go hEachtraí</button>
        )}
        <button onClick={() => setView('landing')}>Ar ais abhaile</button>
      </div>

      {view === 'core' && <ConversationInterface />}

      {view === 'quest-cards' && <IrishSideQuest />}

      {view === 'quest-phrase-rescue' && (
        <section className="quest-placeholder">
          <h1>Tarrtháil Frásaí</h1>
          <p>
            Tá an cluiche seo ar an mbealach. Beidh tú ag ceartú gramadaí agus
            ord focal i bhfrásaí gearra Gaeilge chun pointí a bhaint amach.
          </p>
        </section>
      )}

      {view === 'quest-story-trail' && (
        <section className="quest-placeholder">
          <h1>Scéalta Beaga</h1>
          <p>
            Tá an cluiche seo ar an mbealach. Beidh tú ag roghnú freagraí
            Gaeilge a osclaíonn críocha éagsúla den scéal.
          </p>
        </section>
      )}
    </div>
  );
}

export default App;
