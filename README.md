<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&height=200&text=Craicathon&fontSize=66&fontAlignY=35&animation=twinkling&color=0:0b3b2f,45:1f7a63,100:c89a51&fontColor=fff6e8" alt="Craicathon banner" />
  <h1>Irish Learning Through Voice, Culture, and Play</h1>
  <p><i>Dia duit. A project where language learning feels like a real social experience, not a worksheet.</i></p>
  <p>
    <a href="https://frontend-fwwjsruuf-nathanluisalvares-projects.vercel.app"><img src="https://img.shields.io/badge/Launch-Live%20App-1f7a63?style=for-the-badge" alt="Launch app" /></a>
    <img src="https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-173b67?style=for-the-badge" alt="Frontend stack" />
    <img src="https://img.shields.io/badge/AI-OpenAI%20Voice%20%2B%20Chat-c89a51?style=for-the-badge" alt="AI stack" />
    <img src="https://img.shields.io/badge/Identity-Irish%20Themed-245343?style=for-the-badge" alt="Theme" />
  </p>
</div>

<hr/>

<div>
  <h2>🍀 Mission</h2>
  <blockquote>
    Most tools teach isolated vocabulary. Craicathon teaches living language: hear Irish, speak it, understand it,
    save meaningful phrases, and reuse them through game loops.
  </blockquote>
  <p>
    <strong>Learning loop:</strong>
    <code>Hear -> Speak -> Understand -> Reuse -> Remember</code>
  </p>
</div>

<hr/>

<div>
  <h2>🗺️ Experience Atlas</h2>
  <table>
    <thead>
      <tr>
        <th>Mode</th>
        <th>Learner Action</th>
        <th>Skill Outcome</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>An Comhra Beo</strong><br/>(Conversation)</td>
        <td>Voice/text chat, Irish transcription, AI replies, spoken playback.</td>
        <td>Fluency confidence in real-time conversation.</td>
      </tr>
      <tr>
        <td><strong>Culture Cards</strong></td>
        <td>Regional variations, scenarios, seasonal cards, history notes, saved/learned state.</td>
        <td>Long-term recall with cultural context.</td>
      </tr>
      <tr>
        <td><strong>Pint Dash</strong></td>
        <td>Match pub responses in Irish and serve the correct order.</td>
        <td>Fast comprehension and response accuracy.</td>
      </tr>
    </tbody>
  </table>
</div>

<hr/>

<div>
  <h2>✨ Signature Features</h2>

  <p>
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #2d7c65;background:#123b33;color:#e7fff6;margin-right:6px;">Caint</span>
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #2d7c65;background:#123b33;color:#e7fff6;margin-right:6px;">Cultur</span>
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #2d7c65;background:#123b33;color:#e7fff6;">Cluiche</span>
  </p>

  <div style="border:1px solid #2b6758;border-radius:14px;padding:14px 16px;background:linear-gradient(145deg,#112d2a,#173d36);margin-bottom:12px;">
    <h3 style="margin:0 0 6px;">🎙️ An Comhra Beo</h3>
    <p style="margin:0 0 10px;"><em>Speak naturally. Learn socially.</em></p>
    <ul>
      <li>Voice-to-text transcription for Irish speech input</li>
      <li>AI-generated Irish replies</li>
      <li>OpenAI spoken playback for pronunciation rhythm</li>
      <li>Phrase capture into your personal word bank</li>
    </ul>
  </div>

  <div style="border:1px solid #8b6a3b;border-radius:14px;padding:14px 16px;background:linear-gradient(145deg,#2a2417,#3a3020);margin-bottom:12px;">
    <h3 style="margin:0 0 6px;">📚 Culture Cards</h3>
    <p style="margin:0 0 10px;"><em>From phrase to place, from word to world.</em></p>
    <ul>
      <li>Card of the day plus unlocked/saved/learned collections</li>
      <li>Regional variants: Dublin, Cork, Galway</li>
      <li>Scenario challenge prompts with feedback</li>
      <li>Historical context and seasonal expansions</li>
      <li>Leaderboard progression loops</li>
    </ul>
  </div>

  <div style="border:1px solid #2f4f78;border-radius:14px;padding:14px 16px;background:linear-gradient(145deg,#172232,#1c3049);">
    <h3 style="margin:0 0 6px;">🍺 Pint Dash</h3>
    <p style="margin:0 0 10px;"><em>Learn under pressure in a lively Irish pub scene.</em></p>
    <ul>
      <li>Clickable Irish pub scene with moving barmaid sprite</li>
      <li>Hint-assisted customer language interpretation</li>
      <li>Reply matching before serving logic</li>
      <li>Score, hints, and accuracy feedback</li>
    </ul>
  </div>
</div>

<hr/>

<div>
  <h2>🏗️ Architecture Snapshot</h2>
  <p>
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #2d7c65;background:#123b33;color:#e7fff6;margin-right:6px;">BraiNsear</span>
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #8b6a3b;background:#332914;color:#f8ead0;margin-right:6px;">Freastalaí</span>
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #2f4f78;background:#1a2b43;color:#e8f1ff;">AI Croí</span>
  </p>
  <div style="border:1px solid #2b6758;border-radius:14px;padding:14px 16px;background:linear-gradient(145deg,#112d2a,#173d36);margin-bottom:10px;">
    <p style="margin:0 0 8px;"><em>A simple, sturdy pipeline designed for real learning loops.</em></p>
    <pre><code>Browser (React + Vite)
  |
  +-- /api/* (Vercel serverless handlers in frontend/api/index.ts)
  |      |
  |      +-- OpenAI APIs (chat, transcription, translation, TTS)
  |
  +-- localStorage (flashcards, learned state, user API key, recordings)

Optional local backend mode: backend/src/server.ts</code></pre>
  </div>
</div>

<hr/>

<div>
  <h2>🧰 Tech Stack</h2>
  <p>
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #2d7c65;background:#123b33;color:#e7fff6;margin-right:6px;">React</span>
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #2f4f78;background:#1a2b43;color:#e8f1ff;margin-right:6px;">TypeScript</span>
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #8b6a3b;background:#332914;color:#f8ead0;margin-right:6px;">OpenAI</span>
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #2d7c65;background:#123b33;color:#e7fff6;">Vercel</span>
  </p>

  <table>
    <thead>
      <tr>
        <th>Layer</th>
        <th>Tools</th>
        <th>Role in the Learning Journey</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Frontend</strong></td>
        <td>React + TypeScript + Vite</td>
        <td>Fast, interactive learning UI and side quest experience.</td>
      </tr>
      <tr>
        <td><strong>API</strong></td>
        <td>Vercel Node functions in <code>frontend/api</code></td>
        <td>Handles secure app endpoints for chat, voice, and helpers.</td>
      </tr>
      <tr>
        <td><strong>Local Backend</strong></td>
        <td>Node.js + Express + TypeScript</td>
        <td>Supports local/full API workflow during development.</td>
      </tr>
      <tr>
        <td><strong>Monorepo</strong></td>
        <td>npm workspaces (<code>frontend</code>, <code>backend</code>)</td>
        <td>Keeps frontend and backend changes coordinated.</td>
      </tr>
    </tbody>
  </table>
</div>

<hr/>

<div>
  <h2>🧭 Repository Layout</h2>
  <pre><code>.
|-- backend/
|   |-- src/server.ts
|   |-- api/index.ts
|   `-- vercel.json
|-- frontend/
|   |-- api/index.ts
|   |-- public/irish-girl.gif
|   |-- src/
|   |   |-- App.tsx
|   |   |-- index.css
|   |   `-- components/
|   |       |-- ConversationInterface.tsx
|   |       |-- IrishSideQuest.tsx
|   |       `-- PintDashQuest.tsx
|   `-- vercel.json
|-- .env.example
`-- package.json</code></pre>
</div>

<hr/>

<div>
  <h2>🚀 Quick Start</h2>

  <h3>Prerequisites</h3>
  <ul>
    <li>Node.js 18+</li>
    <li>npm 9+</li>
  </ul>

  <h3>1) Install</h3>
  <pre><code>npm install</code></pre>

  <h3>2) Configure Environment</h3>
  <p>Create <code>.env</code> in repo root:</p>
  <pre><code>OPENAI_API_KEY=your_openai_key

PORT=3001
OPENAI_CHAT_MODEL=gpt-5-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=coral

# Optional future integration
OLLAMA_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral</code></pre>

  <h3>3) Run Development</h3>
  <pre><code>npm run dev</code></pre>
  <ul>
    <li>Frontend: <code>http://localhost:5173</code></li>
    <li>Backend API (local mode): <code>http://localhost:3001</code></li>
  </ul>

  <h3>4) Build + Run Local Production</h3>
  <pre><code>npm run build
npm start</code></pre>
  <p>When frontend build exists, production runs at <code>http://localhost:3001</code>.</p>
</div>

<hr/>

<div>
  <h2>🔌 API Surface</h2>
  <table>
    <thead>
      <tr>
        <th>Method</th>
        <th>Route</th>
        <th>Purpose</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>GET</td><td><code>/api/health</code></td><td>Health + model status</td></tr>
      <tr><td>POST</td><td><code>/api/chat</code></td><td>Text reply + generated audio</td></tr>
      <tr><td>POST</td><td><code>/api/voice-chat</code></td><td>Voice transcript + reply + audio</td></tr>
      <tr><td>POST</td><td><code>/api/translate</code></td><td>Irish to English translation</td></tr>
      <tr><td>POST</td><td><code>/api/pronunciation</code></td><td>Phonetic pronunciation helper</td></tr>
      <tr><td>POST</td><td><code>/api/speak</code></td><td>OpenAI phrase playback for quest buttons</td></tr>
      <tr><td>GET</td><td><code>/api/sidequest/cards</code></td><td>Culture card list</td></tr>
      <tr><td>GET</td><td><code>/api/sidequest/daily</code></td><td>Daily card endpoint</td></tr>
      <tr><td>GET</td><td><code>/api/sidequest/seasonal</code></td><td>Seasonal card feed</td></tr>
      <tr><td>GET</td><td><code>/api/sidequest/leaderboard</code></td><td>Leaderboard fetch</td></tr>
      <tr><td>POST</td><td><code>/api/sidequest/leaderboard</code></td><td>Leaderboard update</td></tr>
    </tbody>
  </table>
</div>

<hr/>

<div>
  <h2>☁️ Deploy on Vercel</h2>
  <pre><code>cd frontend
npx vercel deploy --prod</code></pre>
  <ul>
    <li><code>frontend/vercel.json</code> routes <code>/api/*</code> to serverless handlers</li>
    <li>Run <code>npm run build</code> before deployment</li>
    <li>If env key is absent, user can provide OpenAI key in-app</li>
  </ul>
</div>

<hr/>

<div>
  <h2>🖼️ Assets</h2>
  <p>Main sprite path: <code>frontend/public/irish-girl.gif</code></p>
  <ol>
    <li><code>/irish-girl.gif</code></li>
    <li><code>/irish-girl.png</code></li>
    <li><code>/irish-girl.webp</code></li>
  </ol>
</div>

<hr/>

<div>
  <h2>🛠️ Troubleshooting</h2>

  <details>
    <summary><strong>README preview does not load in VS Code</strong></summary>
    <p>Reload window and clear VS Code Service Worker cache if webview registration fails.</p>
  </details>

  <details>
    <summary><strong>Sprite is missing</strong></summary>
    <ul>
      <li>Verify <code>frontend/public/irish-girl.gif</code> exists</li>
      <li>Restart dev server</li>
      <li>Hard refresh browser</li>
    </ul>
  </details>

  <details>
    <summary><strong>Voice or mic fails</strong></summary>
    <ul>
      <li>Check microphone permissions</li>
      <li>Use HTTPS in deployed mode</li>
      <li>Ensure OpenAI key is available (env key or user-entered key)</li>
    </ul>
  </details>

  <details>
    <summary><strong>Build fails in deployment</strong></summary>
    <ul>
      <li>Run <code>cd frontend && npm run build</code></li>
      <li>Fix TypeScript issues before redeploying</li>
    </ul>
  </details>
</div>

<hr/>

<div>
  <h2>✅ Replication Checklist</h2>
  <ol>
    <li>Clone repository</li>
    <li>Create <code>.env</code> in repo root</li>
    <li>Run <code>npm install</code></li>
    <li>Add sprite file: <code>frontend/public/irish-girl.gif</code></li>
    <li>Run <code>npm run dev</code></li>
    <li>Test Conversation, Culture Cards, and Pint Dash</li>
  </ol>
</div>

<hr/>

<div>
  <h2>🧭 Roadmap</h2>
  <ul>
    <li>County-specific phrase packs and accent variants</li>
    <li>Streak engine and spaced repetition planner</li>
    <li>Classroom co-op mode</li>
    <li>Branching story episodes in Irish social spaces</li>
  </ul>
</div>

<div align="center">
  <h3>Go n-eiri leat.</h3>
</div>
