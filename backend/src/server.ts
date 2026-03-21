import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = 3001;

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

const sideQuestCards: SlangCard[] = [
  {
    id: 'grand',
    phrase: 'Tá sé grand',
    pronunciation: 'taw sheh grand',
    meaning: "It's fine / all good",
    whenToUse: 'When you want to say everything is okay.',
    example: 'Ná bí buartha, tá sé grand.',
    cultureNote: '"Grand" is one of the most common Irish-English expressions in daily life.',
    wordBreakdown: [
      { irish: 'Tá', soundLike: 'taw', tip: 'Long open a sound.' },
      { irish: 'sé', soundLike: 'sheh', tip: 'Soft sh sound at the start.' },
      { irish: 'grand', soundLike: 'grand', tip: 'Same as English here.' }
    ]
  },
  {
    id: 'whisht',
    phrase: 'Fan ciúin a chara',
    pronunciation: 'fahn kyoo-in uh khar-uh',
    meaning: 'Be quiet for a second',
    whenToUse: 'When asking someone to pause while listening to important news.',
    example: 'Fan ciúin a chara, tá an scéal ag tosú.',
    cultureNote: 'In Irish homes, short playful commands are often softened with "a chara".',
    wordBreakdown: [
      { irish: 'Fan', soundLike: 'fahn', tip: 'Short a like in "father".' },
      { irish: 'ciúin', soundLike: 'kyoo-in', tip: 'Two beats: kyoo + in.' },
      { irish: 'a', soundLike: 'uh', tip: 'Very light unstressed sound.' },
      { irish: 'chara', soundLike: 'khar-uh', tip: 'Breathy kh at the start.' }
    ]
  },
  {
    id: 'deadly',
    phrase: 'Sin marfach!',
    pronunciation: 'shin mar-fakh',
    meaning: 'That is brilliant!',
    whenToUse: 'When reacting to something exciting or impressive.',
    example: 'Fuair mé ticéid don cheolchoirm. Sin marfach!',
    cultureNote: 'Like "deadly" in Hiberno-English, some intense words are used positively.',
    wordBreakdown: [
      { irish: 'Sin', soundLike: 'shin', tip: 'Soft sh sound.' },
      { irish: 'marfach', soundLike: 'mar-fakh', tip: 'Final ch is throaty, not "ch" as in chair.' }
    ]
  },
  {
    id: 'craic',
    phrase: 'Cad é an craic?',
    pronunciation: 'kod eh un crack',
    meaning: "What's the story / how are things?",
    whenToUse: 'As a casual friendly greeting.',
    example: 'A Sheáin, cad é an craic inniu?',
    cultureNote: '"Craic" is central to social culture and means fun, atmosphere, and conversation.',
    wordBreakdown: [
      { irish: 'Cad', soundLike: 'kod', tip: 'Short o-like vowel.' },
      { irish: 'é', soundLike: 'eh', tip: 'Short and light.' },
      { irish: 'an', soundLike: 'un', tip: 'Neutral unstressed vowel.' },
      { irish: 'craic', soundLike: 'crack', tip: 'Rhymes with "back".' }
    ]
  },
  {
    id: 'go-on',
    phrase: 'Ar aghaidh leat!',
    pronunciation: 'er ah-hig lat',
    meaning: 'Go on, you can do it!',
    whenToUse: 'To encourage someone before an action.',
    example: 'Tá tú réidh don óráid. Ar aghaidh leat!',
    cultureNote: 'Encouraging phrases are common in Irish banter and sports culture.',
    wordBreakdown: [
      { irish: 'Ar', soundLike: 'er', tip: 'Short, quick opening.' },
      { irish: 'aghaidh', soundLike: 'ah-hig', tip: 'Middle gh is soft and breathy.' },
      { irish: 'leat', soundLike: 'lat', tip: 'Single beat, crisp t ending.' }
    ]
  },
  {
    id: 'surelook',
    phrase: 'Bhuel, sin é an saol',
    pronunciation: 'wel shin eh un sayl',
    meaning: "Sure look, that's life",
    whenToUse: 'When accepting small setbacks with humor.',
    example: 'Chaill mé an bus, ach bhuel, sin é an saol.',
    cultureNote: 'A resigned but warm attitude is a recognizable part of Irish conversational style.',
    wordBreakdown: [
      { irish: 'Bhuel', soundLike: 'wel', tip: 'Starts with a soft v/w blend.' },
      { irish: 'sin', soundLike: 'shin', tip: 'Soft sh sound.' },
      { irish: 'e', soundLike: 'eh', tip: 'Short and light.' },
      { irish: 'an', soundLike: 'un', tip: 'Very light unstressed vowel.' },
      { irish: 'saol', soundLike: 'sayl', tip: 'Single syllable, long ay sound.' }
    ]
  }
];

function getDailyCard(cards: SlangCard[]): SlangCard {
  const now = new Date();
  const daySeed = Number(`${now.getUTCFullYear()}${now.getUTCMonth() + 1}${now.getUTCDate()}`);
  const index = daySeed % cards.length;
  return cards[index];
}

app.use(cors());
app.use(express.json());

// Mock ABAIR API (Text-to-Speech)
app.post('/api/tts', async (req, res) => {
  const { text, voice = 'ga_UL_an_triail_flite_v2' } = req.body;

  try {
    // In a real implementation, you would call ABAIR API here
    // const response = await axios.post('https://abair.ie/api/v2/synthesis', { text, voice });
    // res.json(response.data);
    
    // For now, return a mock URL or success message
    console.log(`Synthesizing text: ${text} with voice: ${voice}`);
    res.json({ 
      success: true, 
      audioUrl: 'https://www.abair.ie/api/public/demo/audio/ga_UL_an_triail_flite_v2.mp3', // Example URL
      text 
    });
  } catch (error) {
    console.error('TTS Error:', error);
    res.status(500).json({ error: 'Failed to synthesize speech' });
  }
});

// Mock Gaelspell/Grammar API
app.post('/api/grammar', (req, res) => {
  const { text } = req.body;
  
  // Simple mock grammar check
  const corrections = [];
  if (text.toLowerCase().includes('failte')) {
    corrections.push({
      original: 'failte',
      suggestion: 'fáilte',
      explanation: 'Missing fada on "a"'
    });
  }
  
  res.json({ corrections });
});

// Chat completion (Mock OpenAI/Anthropic)
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  
  // Simple response logic for demonstration
  let reply = "Dia duit! Conas atá tú?";
  if (message.toLowerCase().includes('conas')) {
    reply = "Tá mé go maith, go raibh maith agat. Agus tú féin?";
  } else if (message.toLowerCase().includes('maith')) {
    reply = "Is maith sin a chloisteáil!";
  }
  
  res.json({ reply });
});

app.get('/api/sidequest/cards', (_req, res) => {
  res.json({ cards: sideQuestCards });
});

app.get('/api/sidequest/daily', (_req, res) => {
  res.json({ card: getDailyCard(sideQuestCards) });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
